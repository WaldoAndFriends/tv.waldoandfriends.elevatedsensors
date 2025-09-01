'use strict';

const Homey = require('homey');

module.exports = class BedPresenceDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('BedPresenceDriver has been initialized');
  }

  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    const discoveryStrategy = this.getDiscoveryStrategy();
    const discoveryResults = discoveryStrategy.getDiscoveryResults();

    const devicePromises = Object.values(discoveryResults).map(async discoveryResult => {
      return {
        name: discoveryResult.id,
        data: {
          id: discoveryResult.id,
        },
        store: {
          address: discoveryResult.address,
          port: discoveryResult.port,
        },
      };
    });

    return await Promise.all(devicePromises);
  }

};
