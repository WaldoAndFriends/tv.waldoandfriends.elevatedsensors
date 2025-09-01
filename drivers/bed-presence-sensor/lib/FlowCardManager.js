'use strict';

/**
 * FlowCardManager handles flow card initialization and registration
 */
class FlowCardManager {
  constructor(device) {
    this.device = device;
    this._becameOccupied = null;
    this._becameUnoccupied = null;
    this._isOccupied = null;
  }

  /**
   * Initialize flow cards for triggers and conditions
   */
  initialize() {
    this.device.log('Initializing flow cards...');
    
    // Trigger cards
    this._becameOccupied = this.device.homey.flow.getDeviceTriggerCard("became-occupied");
    this._becameOccupied.registerRunListener(async (args, state) => {
      return args.side === state.side;
    });

    this._becameUnoccupied = this.device.homey.flow.getDeviceTriggerCard("became-unoccupied");
    this._becameUnoccupied.registerRunListener(async (args, state) => {
      return args.side === state.side;
    });

    // Condition cards
    this._isOccupied = this.device.homey.flow.getConditionCard("is-occupied");
    this._isOccupied.registerRunListener(async (args, state) => {
      return this._checkOccupancyCondition(args.side);
    });
    
    this.device.log('Flow cards initialized successfully');
  }

  /**
   * Check occupancy condition for different sides
   */
  _checkOccupancyCondition(side) {
    const leftOccupied = this.device.getCapabilityValue('alarm_presence.left') === true;
    const rightOccupied = this.device.getCapabilityValue('alarm_presence.right') === true;
    
    switch (side) {
      case 'left':
        return leftOccupied;
      case 'right':
        return rightOccupied;
      case 'either':
        return leftOccupied || rightOccupied;
      case 'both':
        return leftOccupied && rightOccupied;
      default:
        this.device.error(`Unknown side: ${side}`);
        return false;
    }
  }

  /**
   * Trigger occupancy flow cards
   */
  triggerOccupancyChange(side, isOccupied) {
    if (isOccupied) {
      this._becameOccupied.trigger(this.device, {}, { side });
    } else {
      this._becameUnoccupied.trigger(this.device, {}, { side });
    }
  }
}

module.exports = FlowCardManager;
