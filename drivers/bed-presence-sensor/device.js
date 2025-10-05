'use strict';

const Homey = require('homey');
const ESPHomeManager = require('./lib/ESPHomeManager');
const FlowCardManager = require('./lib/FlowCardManager');
const CapabilityManager = require('./lib/CapabilityManager');
const EventHandlers = require('./lib/EventHandlers');

module.exports = class BedPresenceDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    try {
      this.log('Initializing BedPresenceDevice...');
      
      await this.migrateCapabilities();

      // Initialize managers
      this.espHomeManager = new ESPHomeManager(this);
      this.flowCardManager = new FlowCardManager(this);
      this.capabilityManager = new CapabilityManager(this, this.espHomeManager);
      this.eventHandlers = new EventHandlers(this, this.flowCardManager);

      // Connectivity monitor state
      this._pingFailures = 0;
      this._offlineDueToPing = false;
      this._monitorTimer = null;
      this._monitorBusy = false;

      // Online check cadence
      this._onlinePingIntervalMs = 10000;     // 10s
      this._pingTimeoutMs = 2000;             // 2s per attempt
      this._maxPingFailures = 3;              // mark offline after 3 consecutive failures

      // Offline backoff strategy
      this._offlineBackoffInitialMs = 20000;  // 20s
      this._offlineBackoffMaxMs = 300000;     // 5 minutes
      this._offlineBackoffFactor = 1.5;       //  backoff factor
      this._currentOfflineBackoffMs = null;
      
      // Initialize flow cards
      this.flowCardManager.initialize();
      
      // Initialize ESPHome client
      this.client = await this.espHomeManager.initialize();
      
      // Register capability listeners
      this.capabilityManager.registerListeners();
    
      // Register ESPHome event handlers
      this.eventHandlers.register(this.client);

      // Start connectivity monitor
      this._startConnectivityMonitor();

      this.log('BedPresenceDevice has been initialized successfully');
    } catch (error) {
      this.error('Failed to initialize BedPresenceDevice:', error);
      throw error;
    }
  }

    /**
   * Ensure required capabilities are available on the device
   * This method handles capability migrations for existing devices
   */
  async migrateCapabilities() {
    try {
      // Check for alarm_presence capability
      if (this.hasCapability('alarm_presence') === false) {
        this.log('Adding missing alarm_presence capability...');
        await this.addCapability('alarm_presence');
        this.log('Successfully added alarm_presence capability');
      }

    } catch (error) {
      this.error('Failed to migrate:', error);
      throw error;
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('BedPresenceDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('BedPresenceDevice settings changed:', {
      oldSettings,
      newSettings,
      changedKeys
    });
    
    // Check if connection settings changed and reconnect if needed
    const connectionChanged = changedKeys.some(key => ['address', 'port'].includes(key));
    if (connectionChanged && this.espHomeManager) {
      try {
        this._resetConnectivityMonitorState();
        this.client = await this.espHomeManager.reconnect();
        // Re-register event handlers with new client
        this.eventHandlers.register(this.client);
        // Restart monitor with new settings
        this._stopConnectivityMonitor();
        this._startConnectivityMonitor();
        this.log('ESPHome client reconnected successfully');
      } catch (error) {
        this.error('Failed to reconnect ESPHome client:', error);
        throw new Error('Failed to reconnect to ESPHome device with new settings');
      }
    }
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log(`BedPresenceDevice was renamed to: ${name}`);
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('BedPresenceDevice is being deleted, cleaning up...');
    
    // Stop connectivity monitor
    this._stopConnectivityMonitor();

    // Clean up ESPHome client connection
    if (this.espHomeManager) {
      this.espHomeManager.disconnect();
    }
    
    this.log('BedPresenceDevice has been deleted');
  }

  /**
   * Start a periodic connectivity monitor using a TCP ping
   * to detect stale connections faster than the client library.
   */
  _startConnectivityMonitor() {
    if (this._monitorTimer) return;

    this.log(`Starting connectivity monitor (onlineInterval=${this._onlinePingIntervalMs}ms, timeout=${this._pingTimeoutMs}ms, maxFailures=${this._maxPingFailures}, offlineInitialBackoff=${this._offlineBackoffInitialMs}ms, offlineMaxBackoff=${this._offlineBackoffMaxMs}ms)`);

    // Schedule the first check on the online cadence
    this._scheduleNextCheck(this._onlinePingIntervalMs);
  }

  _scheduleNextCheck(delayMs) {
    if (this._monitorTimer) {
      clearTimeout(this._monitorTimer);
      this._monitorTimer = null;
    }
    this._monitorTimer = setTimeout(() => this._runConnectivityCheck(), delayMs);
  }

  async _runConnectivityCheck() {
    if (this._monitorBusy) {
      // Try again soon to avoid piling up
      this._scheduleNextCheck(1000);
      return;
    }
    this._monitorBusy = true;
    try {
      const reachable = await this.espHomeManager.ping(this._pingTimeoutMs);
      if (reachable) {
        // Reset failures on any success
        this._pingFailures = 0;

        if (this._offlineDueToPing) {
          // We were offline due to ping; attempt to reconnect client
          this.log('Device reachable again, attempting to re-connect ESPHome client...');
          try {
            this.espHomeManager.disconnect();
            this.client = await this.espHomeManager.initialize();
            this.eventHandlers.register(this.client);
            await this.setAvailable();
            this._offlineDueToPing = false;
          } catch (reconnectErr) {
            this.error('Failed to re-connect after reachability restored:', reconnectErr);
          }
        }

        // Reset offline backoff state and schedule next regular check
        this._currentOfflineBackoffMs = null;
        this._scheduleNextCheck(this._onlinePingIntervalMs);
      } else {
        this._pingFailures += 1;
        this.error(`Ping failed (${this._pingFailures}/${this._maxPingFailures})`);

        if (!this._offlineDueToPing && this._pingFailures >= this._maxPingFailures) {
          // Consider connection lost; mark unavailable and disconnect client
          const { host, port } = this.espHomeManager.getConnectionInfo();
          await this.setUnavailable(`Device not reachable at ${host}:${port}`);
          this.espHomeManager.disconnect();
          this._offlineDueToPing = true;
          // Initialize offline backoff
          this._currentOfflineBackoffMs = this._offlineBackoffInitialMs;
        }

        if (this._offlineDueToPing) {
          const { host, port } = this.espHomeManager.getConnectionInfo();
          await this.setUnavailable(`Device not reachable at ${host}:${port} after ${this._pingFailures} failed attempts`);
          // Determine next delay with backoff
          if (!this._currentOfflineBackoffMs) {
            this._currentOfflineBackoffMs = this._offlineBackoffInitialMs;
          } else {
            this._currentOfflineBackoffMs = Math.min(
              Math.floor(this._currentOfflineBackoffMs * this._offlineBackoffFactor),
              this._offlineBackoffMaxMs
            );
          }
          this._scheduleNextCheck(this._currentOfflineBackoffMs);
        } else {
          // Not yet marked offline: keep the regular cadence for detection window
          this._scheduleNextCheck(this._onlinePingIntervalMs);
        }
      }
    } catch (err) {
      this.error('Connectivity monitor error:', err);
      // In case of internal errors, try again soon but not too aggressively
      this._scheduleNextCheck(5000);
    } finally {
      this._monitorBusy = false;
    }
  }

  _stopConnectivityMonitor() {
    if (this._monitorTimer) {
      clearTimeout(this._monitorTimer);
      this._monitorTimer = null;
    }
  }

  _resetConnectivityMonitorState() {
    this._pingFailures = 0;
    this._offlineDueToPing = false;
    this._currentOfflineBackoffMs = null;
  }
};
