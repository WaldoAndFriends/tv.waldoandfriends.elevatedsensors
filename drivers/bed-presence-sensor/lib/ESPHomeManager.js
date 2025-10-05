'use strict';

/**
 * ESPHomeManager handles ESPHome client initialization and connection management
 */
class ESPHomeManager {
  constructor(device) {
    this.device = device;
    this.client = null;
  }

  /**
   * Initialize ESPHome client and set up communication
   */
  async initialize() {
    this.device.log('Initializing ESPHome client...');
    
    const { EspHomeClient } = await import('esphome-client');
    
    const host = this.device.getStoreValue('address');
    const port = this.device.getStoreValue('port');
    
    this.device.log(`Connecting to ESPHome device at ${host}:${port}`);
    
    this.client = new EspHomeClient({
      host,
      port,
      reconnect: true,
      reconnectInterval: 15000,
      connectionTimeout: 30000,
      clientId: 'homey-elevated-sensors',
    });
    
    // Connect to ESPHome device
    this.client.connect();
    this.device.log('ESPHome client initialized and connecting...');
    
    return this.client;
  }

  /**
   * Reconnect to ESPHome device with new settings
   */
  async reconnect() {
    this.device.log('Connection settings changed, reconnecting ESPHome client...');
    
    if (this.client) {
      this.client.disconnect();
    }
    
    return await this.initialize();
  }

  /**
   * Disconnect ESPHome client
   */
  disconnect() {
    if (this.client) {
      try {
        this.client.disconnect();
        this.device.log('ESPHome client disconnected successfully');
      } catch (error) {
        this.device.error('Error disconnecting ESPHome client:', error);
      }
    }
  }

  /**
   * Get current connection info (host, port)
   */
  getConnectionInfo() {
    const host = this.device.getStoreValue('address');
    const port = this.device.getStoreValue('port');
    return { host, port };
  }

  /**
   * Lightweight TCP ping to the ESPHome device's API port.
   * Returns true if a TCP connection can be established within the timeout.
   * Avoids dependency on ICMP privileges.
   * @param {number} timeoutMs
   * @returns {Promise<boolean>}
   */
  async ping(timeoutMs = 2000) {
    const net = require('net');
    const { host, port } = this.getConnectionInfo();

    if (!host || !port) {
      this.device.error('Ping aborted: missing host or port');
      return false;
    }

    return new Promise((resolve) => {
      let settled = false;
      const socket = new net.Socket();

      const onDone = (result) => {
        if (settled) return;
        settled = true;
        try { socket.destroy(); } catch (_) { /* noop */ }
        resolve(result);
      };

      const timeout = setTimeout(() => onDone(false), timeoutMs);

      socket.once('connect', () => {
        clearTimeout(timeout);
        onDone(true);
      });
      socket.once('error', () => {
        clearTimeout(timeout);
        onDone(false);
      });
      socket.once('timeout', () => {
        clearTimeout(timeout);
        onDone(false);
      });

      try {
        socket.setTimeout(timeoutMs);
        socket.connect({ host, port });
      } catch (e) {
        clearTimeout(timeout);
        onDone(false);
      }
    });
  }

  /**
   * Get the ESPHome client instance
   */
  getClient() {
    return this.client;
  }
}

module.exports = ESPHomeManager;
