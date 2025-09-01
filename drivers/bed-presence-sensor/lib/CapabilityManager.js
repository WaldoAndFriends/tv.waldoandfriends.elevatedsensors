'use strict';

/**
 * CapabilityManager handles capability listeners and updates
 */
class CapabilityManager {
  constructor(device, espHomeManager) {
    this.device = device;
    this.espHomeManager = espHomeManager;
  }

  /**
   * Register capability listeners for device controls
   */
  registerListeners() {
    this.device.log('Registering capability listeners...');
    
    // Pressure trigger sliders
    this._registerPressureListeners();
    
    // Calibration buttons
    this._registerCalibrationListeners();
    
    // Configuration pickers
    this._registerConfigurationListeners();
    
    this.device.log('Capability listeners registered successfully');
  }

  /**
   * Register pressure trigger capability listeners
   */
  _registerPressureListeners() {
    this.device.registerCapabilityListener("trigger_pressure.left", async (value) => {
      try {
        this.device.log(`Setting left trigger pressure to ${value}`);
        const client = this.espHomeManager.getClient();
        await client.sendNumberCommand('number-left_trigger_pressure', value * 100);
        this.device.setCapabilityValue('trigger_pressure.left', value);
      } catch (error) {
        this.device.error('Failed to set left trigger pressure:', error);
        throw error;
      }
    });

    this.device.registerCapabilityListener("trigger_pressure.right", async (value) => {
      try {
        this.device.log(`Setting right trigger pressure to ${value}`);
        const client = this.espHomeManager.getClient();
        await client.sendNumberCommand('number-right_trigger_pressure', value * 100);
        this.device.setCapabilityValue('trigger_pressure.right', value);
      } catch (error) {
        this.device.error('Failed to set right trigger pressure:', error);
        throw error;
      }
    });
  }

  /**
   * Register calibration button capability listeners
   */
  _registerCalibrationListeners() {
    const calibrationButtons = [
      { capability: "button.calibrate_left_occupied", command: 'button-calibrate_left_occupied', desc: 'left occupied' },
      { capability: "button.calibrate_left_unoccupied", command: 'button-calibrate_left_unoccupied', desc: 'left unoccupied' },
      { capability: "button.calibrate_right_occupied", command: 'button-calibrate_right_occupied', desc: 'right occupied' },
      { capability: "button.calibrate_right_unoccupied", command: 'button-calibrate_right_unoccupied', desc: 'right unoccupied' }
    ];

    calibrationButtons.forEach(button => {
      this.device.registerCapabilityListener(button.capability, async (value) => {
        try {
          this.device.log(`Triggering calibration: ${button.desc}`);
          const client = this.espHomeManager.getClient();
          await client.sendButtonCommand(button.command);
        } catch (error) {
          this.device.error(`Failed to trigger ${button.desc} calibration:`, error);
          throw error;
        }
      });
    });
  }

  /**
   * Register configuration capability listeners
   */
  _registerConfigurationListeners() {
    this.device.registerCapabilityListener("full_range_mode", async (value) => {
      try {
        const boolValue = value === "On";
        this.device.log(`Setting full range mode to ${boolValue}`);
        const client = this.espHomeManager.getClient();
        await client.sendSwitchCommand('switch-full_range', boolValue);
        this.device.setCapabilityValue('full_range_mode', value);
      } catch (error) {
        this.device.error('Failed to set full range mode:', error);
        throw error;
      }
    });

    this.device.registerCapabilityListener("response_speed_mode", async (value) => {
      try {
        this.device.log(`Setting response speed mode to ${value}`);
        const client = this.espHomeManager.getClient();
        await client.sendSelectCommand('select-response_speed', value);
        this.device.setCapabilityValue('response_speed_mode', value);
      } catch (error) {
        this.device.error('Failed to set response speed mode:', error);
        throw error;
      }
    });
  }
}

module.exports = CapabilityManager;
