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
   * Get the ESPHome client instance
   */
  getClient() {
    return this.client;
  }
}

module.exports = ESPHomeManager;
