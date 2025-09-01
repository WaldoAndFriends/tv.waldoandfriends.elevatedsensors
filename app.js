'use strict';

const Homey = require('homey');
const { Log } = require('homey-log');

module.exports = class ElevatedSensorsApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.homeyLog = new Log({ homey: this.homey });
    this.log('ElevatedSensorsApp has been initialized');
  }

};
