'use strict';

const Homey = require('homey');

module.exports = class BedPresenceDevice extends Homey.Device {
  

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this._becameOccupied = this.homey.flow.getDeviceTriggerCard("became-occupied");
    this._becameOccupied.registerRunListener(async (args, state) => {
      return args.side === state.side;
    });

    this._becameUncccupied = this.homey.flow.getDeviceTriggerCard("became-unoccupied");
    this._becameUncccupied.registerRunListener(async (args, state) => {
      return args.side === state.side;
    });

    this._isOccupied = this.homey.flow.getConditionCard("is-occupied");
    this._isOccupied.registerRunListener(async (args, state) => {
      if (args.side === 'left') {
        return this.getCapabilityValue('alarm_presence.left') === true;
      }
      if (args.side === 'right') {
        return this.getCapabilityValue('alarm_presence.right') === true;
      }
      if (args.side === 'either') {
        return this.getCapabilityValue('alarm_presence.left') === true || this.getCapabilityValue('alarm_presence.right') === true;
      }
      if (args.side === 'both') {
        return this.getCapabilityValue('alarm_presence.left') === true && this.getCapabilityValue('alarm_presence.right') === true;
      }
      return false;
    });

    const { EspHomeClient } = await import('esphome-client');
    const client = new EspHomeClient({
      host: this.getStoreValue('address'),
      port: this.getStoreValue('port'),
      reconnect: true,
      reconnectInterval: 15000,
      connectionTimeout: 30000,
      clientId: 'homey-elevated-sensors',
    });

    // Sliders
    this.registerCapabilityListener("trigger_pressure.left", async (value) => {
      await client.sendNumberCommand('number-left_trigger_pressure', value * 100);
      this.setCapabilityValue('trigger_pressure.left', value);
    });
    this.registerCapabilityListener("trigger_pressure.right", async (value) => {
      await client.sendNumberCommand('number-right_trigger_pressure', value * 100);
      this.setCapabilityValue('trigger_pressure.right', value);
    });

    // Buttons
    this.registerCapabilityListener("button.calibrate_left_occupied", async (value) => {
      await client.sendButtonCommand('button-calibrate_left_occupied');
    });
    this.registerCapabilityListener("button.calibrate_left_unoccupied", async (value) => {
      await client.sendButtonCommand('button-calibrate_left_unoccupied');
    });
    this.registerCapabilityListener("button.calibrate_right_occupied", async (value) => {
      await client.sendButtonCommand('button-calibrate_right_occupied');
    });
    this.registerCapabilityListener("button.calibrate_right_unoccupied", async (value) => {
      await client.sendButtonCommand('button-calibrate_right_unoccupied');
    });

    // Pickers
    this.registerCapabilityListener("full_range_mode", async (value) => {
      await client.sendSwitchCommand('switch-full_range', value === "On" ? true : false);
      this.setCapabilityValue('full_range_mode', value);
    });

    this.registerCapabilityListener("response_speed_mode", async (value) => {
      await client.sendSelectCommand('select-response_speed', value);
      this.setCapabilityValue('response_speed_mode', value);
    });


    // Handle incoming updates from ESPHome
    client.on('binary_sensor', (data) => {
      data.state = data.state || false;
      //console.log('Received binary update:', data);
      if (data.entity === 'Bed Occupied Left') {
        this.setCapabilityValue('alarm_presence.left', data.state);
        if (data.state) {
          this._becameOccupied.trigger(this, {}, { side: 'left' });
        }
        else {
          this._becameUncccupied.trigger(this, {}, { side: 'left' });
        }
      }

      if (data.entity === 'Bed Occupied Right') {
        this.setCapabilityValue('alarm_presence.right', data.state);
        if (data.state) {
          this._becameOccupied.trigger(this, {}, { side: 'right' });
        }
        else {
          this._becameUncccupied.trigger(this, {}, { side: 'right' });
        }
      }

      // Eiter/Both don't have specific capabilities, so only trigger flows.
      if (data.entity === 'Bed Occupied Either') {
        if (data.state) {
          this._becameOccupied.trigger(this, {}, { side: 'either' });
        }
        else {
          this._becameUncccupied.trigger(this, {}, { side: 'either' });
        }
      }

      if (data.entity === 'Bed Occupied Both') {
        if (data.state) {
          this._becameOccupied.trigger(this, {}, { side: 'both' });
        }
        else {
          this._becameUncccupied.trigger(this, {}, { side: 'both' });
        }
      }
    });

    client.on('number', (data) => {
      //console.log('Received number update:', data);      
      if (data.entity === 'Left Trigger Pressure') {
        data.state = data.state || 0;
        const newValue = data.state / 100;
        if (newValue !== this.getCapabilityValue('trigger_pressure.left')) {
          this.setCapabilityValue('trigger_pressure.left', newValue);
        }
      }

      if (data.entity === 'Right Trigger Pressure') {
        data.state = data.state || 0;
        const newValue = data.state / 100;
        if (newValue !== this.getCapabilityValue('trigger_pressure.right')) {
          this.setCapabilityValue('trigger_pressure.right', newValue);
        }
      }
    });

    client.on('sensor', (data) => {
      if (data.entity === 'Left Pressure') {
        data.state = data.state || 0;

        if (data.state !== this.getCapabilityValue('measure_confidence.left')) {
          this.setCapabilityValue('measure_confidence.left', data.state);
        }
      }

      if (data.entity === 'Right Pressure') {
        data.state = data.state || 0;

        if (data.state !== this.getCapabilityValue('measure_confidence.right')) {
          this.setCapabilityValue('measure_confidence.right', data.state);
        }
      }
    });

    client.on('select', (data) => {
      //console.log('Received select update:', data);
      if (data.entity === 'Response Speed') {
        if (data.state && data.state !== this.getCapabilityValue('response_speed_mode')) {
          this.setCapabilityValue('response_speed_mode', data.state);
        }
      }
    });

    client.on('switch', (data) => {
      //console.log('Received switch update:', data);
      if (data.entity === 'Full Range') {
        // if data.state is undefined set it to false.
        data.state = data.state || false;
        this.setCapabilityValue('full_range_mode', data.state ? "On" : "Off");
      }
      
    });


    client.connect();
    this.log('BedPresenceDevice has been initialized');
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
    this.log('BedPresenceDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('BedPresenceDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('BedPresenceDevice has been deleted');
  }

};
