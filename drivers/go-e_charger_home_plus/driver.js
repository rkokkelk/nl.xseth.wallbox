'use strict';

const Homey = require('homey');
const goechargerApi = require("../../api/api.js");


class goe_charger_home_plus extends Homey.Driver {

	onInit() {
		this.log('goe_charger_home_plus has been inited');
	}

	async onPair(socket) {
			this.log('pairing started');
			socket.on('testConnection', async (ip, callback) => {
					try {
							console.log(ip);
							const api = new goechargerApi(ip, null);
							const info = await api.getInfo();
							console.log(info);
							callback(false, info);
					} catch (e) {
							console.log(e);
							callback(true, e);
					}
			});
	}
}

module.exports = goe_charger_home_plus;
