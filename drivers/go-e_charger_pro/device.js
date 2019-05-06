'use strict';

const Homey = require('homey');

class goe_charger_pro_device extends Homey.Device {

	onInit() {
		this.log('goe_charger_pro_device has been inited');
	}

}

module.exports = goe_charger_pro_device;
