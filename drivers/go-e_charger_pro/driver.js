'use strict';

const Homey = require('homey');

class goe_charger_pro extends Homey.Driver {

	onInit() {
		this.log('goe_charger_pro has been inited');
	}

}

module.exports = goe_charger_pro;
