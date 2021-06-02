'use strict';

const Homey = require('homey');
const WallboxAPI = require('/lib/wallbox_api');

class goe_charger_home_plus extends Homey.Driver {

	onInit() {
		this.log('goe_charger_home_plus has been inited');
	}

	async onPair(socket) {
			this.log('pairing started');
			socket.on('testConnection', async (data, callback) => {
					try {
					    let user = data['user'];
					    let pass = data['pass'];
							this.log(user+ ' ' + pass);
							const api = new WallboxAPI(user, pass);
						  await api.authenticate();
						  const chargers = await api.getChargers();
							this.log(chargers);
							this.log(chargers['result']['groups']);
							this.log(chargers['result']['groups'][0]['chargers']);
							callback(false, chargers);
					} catch (e) {
							console.log(e);
							callback(true, e);
					}
			});
	}
}

module.exports = goe_charger_home_plus;
