'use strict';

/**
 * EventHandlers handles ESPHome event processing
 */
class EventHandlers {
  constructor(device, flowCardManager) {
    this.device = device;
    this.flowCardManager = flowCardManager;
  }

  /**
   * Register ESPHome event handlers
   */
  register(client) {
    this.device.log('Registering ESPHome event handlers...');
    
    client.on('binary_sensor', (data) => this._handleBinarySensorUpdate(data));
    client.on('number', (data) => this._handleNumberUpdate(data));
    client.on('sensor', (data) => this._handleSensorUpdate(data));
    client.on('select', (data) => this._handleSelectUpdate(data));
    client.on('switch', (data) => this._handleSwitchUpdate(data));
    
    this.device.log('ESPHome event handlers registered successfully');
  }

  /**
   * Handle binary sensor updates (occupancy detection)
   */
  _handleBinarySensorUpdate(data) {
    data.state = data.state || false;
    this.device.log(`Received binary sensor update - Entity: ${data.entity}, State: ${data.state}`);
    
    const entityHandlers = {
      'Bed Occupied Left': () => this._handleOccupancyUpdate('left', data.state),
      'Bed Occupied Right': () => this._handleOccupancyUpdate('right', data.state),
      'Bed Occupied Either': () => this._handleOccupancyUpdate('either', data.state),
      'Bed Occupied Both': () => this._handleOccupancyUpdate('both', data.state)
    };

    const handler = entityHandlers[data.entity];
    if (handler) {
      handler();
    } else {
      this.device.log(`Unknown binary sensor entity: ${data.entity}`);
    }
  }

  /**
   * Handle occupancy updates for different sides
   */
  _handleOccupancyUpdate(side, state) {
    // Update capability values for left/right sides only
    if (side === 'left' || side === 'right') {
      this.device.setCapabilityValue(`alarm_presence.${side}`, state);
      // Update overall alarm_presence based on either side
      this.device.setCapabilityValue(`alarm_presence`, this.device.getCapabilityValue('alarm_presence.left') || this.device.getCapabilityValue('alarm_presence.right'));
    }

    // Trigger appropriate flow cards
    this.flowCardManager.triggerOccupancyChange(side, state);
    
    this.device.log(`${side} side ${state ? 'became occupied' : 'became unoccupied'}`);
  }

  /**
   * Handle number updates (trigger pressure settings)
   */
  _handleNumberUpdate(data) {
    this.device.log(`Received number update - Entity: ${data.entity}, State: ${data.state}`);
    
    data.state = data.state || 0;
    const newValue = data.state / 100;

    if (data.entity === 'Left Trigger Pressure') {
      if (newValue !== this.device.getCapabilityValue('trigger_pressure.left')) {
        this.device.setCapabilityValue('trigger_pressure.left', newValue);
        this.device.log(`Updated left trigger pressure to ${newValue}`);
      }
    } else if (data.entity === 'Right Trigger Pressure') {
      if (newValue !== this.device.getCapabilityValue('trigger_pressure.right')) {
        this.device.setCapabilityValue('trigger_pressure.right', newValue);
        this.device.log(`Updated right trigger pressure to ${newValue}`);
      }
    } else {
      this.device.log(`Unknown number entity: ${data.entity}`);
    }
  }

  /**
   * Handle sensor updates (pressure measurements)
   */
  _handleSensorUpdate(data) {
    this.device.log(`Received sensor update - Entity: ${data.entity}, State: ${data.state}`);
    
    data.state = data.state || 0;

    if (data.entity === 'Left Pressure') {
      if (data.state !== this.device.getCapabilityValue('measure_confidence.left')) {
        this.device.setCapabilityValue('measure_confidence.left', data.state);
        this.device.log(`Updated left pressure measurement to ${data.state}`);
      }
    } else if (data.entity === 'Right Pressure') {
      if (data.state !== this.device.getCapabilityValue('measure_confidence.right')) {
        this.device.setCapabilityValue('measure_confidence.right', data.state);
        this.device.log(`Updated right pressure measurement to ${data.state}`);
      }
    } else {
      this.device.log(`Unknown sensor entity: ${data.entity}`);
    }
  }

  /**
   * Handle select updates (response speed mode)
   */
  _handleSelectUpdate(data) {
    this.device.log(`Received select update - Entity: ${data.entity}, State: ${data.state}`);
    
    if (data.entity === 'Response Speed') {
      if (data.state && data.state !== this.device.getCapabilityValue('response_speed_mode')) {
        this.device.setCapabilityValue('response_speed_mode', data.state);
        this.device.log(`Updated response speed mode to ${data.state}`);
      }
    } else {
      this.device.log(`Unknown select entity: ${data.entity}`);
    }
  }

  /**
   * Handle switch updates (full range mode)
   */
  _handleSwitchUpdate(data) {
    this.device.log(`Received switch update - Entity: ${data.entity}, State: ${data.state}`);
    
    if (data.entity === 'Full Range') {
      data.state = data.state || false;
      const newValue = data.state ? "On" : "Off";
      if (newValue !== this.device.getCapabilityValue('full_range_mode')) {
        this.device.setCapabilityValue('full_range_mode', newValue);
        this.device.log(`Updated full range mode to ${newValue}`);
      }
    } else {
      this.device.log(`Unknown switch entity: ${data.entity}`);
    }
  }
}

module.exports = EventHandlers;
