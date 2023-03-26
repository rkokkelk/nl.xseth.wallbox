'use strict';

const inspector = require('inspector');
const Homey = require('homey');

if (process.env.DEBUG === '1') {
    require('inspector').open(9222, '0.0.0.0', true);
}

class wallboxapp extends Homey.App {

	onInit() {

		if (process.env.DEBUG === '1')
			inspector.open(8080, '0.0.0.0', true)

		this.log('wallboxapp is running...');
	}
}

module.exports = wallboxapp;
