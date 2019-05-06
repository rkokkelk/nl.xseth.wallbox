'use strict';

const Homey = require('homey');

class goe_charger_home_plus_device extends Homey.Device {

	onInit() {
		this.log('goe_charger_home_plus_device has been inited');
	}

}

module.exports = goe_charger_home_plus_device;
