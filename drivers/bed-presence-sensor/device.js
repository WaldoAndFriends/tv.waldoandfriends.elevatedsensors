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
      
      // Initialize flow cards
      this.flowCardManager.initialize();
      
      // Initialize ESPHome client
      this.client = await this.espHomeManager.initialize();
      
      // Register capability listeners
      this.capabilityManager.registerListeners();
    
      // Register ESPHome event handlers
      this.eventHandlers.register(this.client);

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
        this.client = await this.espHomeManager.reconnect();
        // Re-register event handlers with new client
        this.eventHandlers.register(this.client);
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
    
    // Clean up ESPHome client connection
    if (this.espHomeManager) {
      this.espHomeManager.disconnect();
    }
    
    this.log('BedPresenceDevice has been deleted');
  }

};
