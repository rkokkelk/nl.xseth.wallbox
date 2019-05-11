'use strict';

const Homey = require('homey');

class goe_charger_home_plus_device extends Homey.Device {
	async onInit() {
			this.log('device init');
			let settings = this.getSettings();
			let name = this.getName() + '_' + this.getData().id;
			this._registerCapabilities();
			} // end onInit

			onAdded() {
	        let id = this.getData().id;
	        this.log('device_added: ', id);
	        this.log('name:', this.getName());
	        this.log('device_class:', this.getClass());
	        this.log('settings:', this.getSettings());
	        this.log('data:', this.getData());
					this.log('allow:', this.getData().onoff);
	    } // end onAdded

	    onDeleted() {

	        let id = this.getData().id;
	        //clearInterval(this.pollingIntervalCurrent);
	        this.log('device deleted:', id);
					this.available = false;

	    } // end onDeleted

			_registerCapabilities() {
			const capabilitySetMap = new Map([
					["onoff", this.getData().alw]/**,
	        ["measure_power", this.getData().dataContainer.nrg[11]/100],
	        ["measure_current", (this.getData().dataContainer.nrg[7]+this.getData().dataContainer.nrg[8]+this.getData().dataContainer.nrg[9])/10],
	        ["measure_voltage", this.getData().dataContainer.nrg[0]+this.getData().dataContainer.nrg[1]+this.getData().dataContainer.nrg[2]],
	        ["measure_temperature",this.getData().dataContainer.tmp],
	        ["meter_power", this.getData().dataContainer.dws*0.00000277]**/
					]);
					this.getCapabilities().forEach(capability =>
					this.registerCapabilityListener(capability, (value) => {
							return capabilitySetMap.get(capability).call(this, value)
									.catch(err => {
											return Promise.reject(err);
									});
					}))
			} // end _registerCapabilities

}
module.exports = goe_charger_home_plus_device;
