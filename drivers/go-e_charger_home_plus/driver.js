'use strict';

const Homey = require('homey');

class goe_charger_home_plus extends Homey.Driver {

	onInit() {
		this.log('go-e_charger_home_plus has been inited');
	}

}

module.exports = goe_charger_home_plus;
