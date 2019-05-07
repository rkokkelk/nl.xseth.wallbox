'use strict';

const Homey = require('homey');

class goe_charger_home_plus extends Homey.Driver {

	onInit() {
		this.log('goe_charger_home_plus has been inited');
	}

	onPair( socket ) {
    const devices = [
      {
        'name': 'go-e charger home plus',
        'data': {
          'id': 'abcd',
        }
      }
    ]

    socket.on('list_devices', function( data, callback ) {
      // emit when devices are still being searched
      socket.emit('list_devices', devices );

      // fire the callback when searching is done
      callback( null, devices );

      // when no devices are found, return an empty array
      // callback( null, [] );

      // or fire a callback with Error to show that instead
      // callback( new Error('Something bad has occured!') );
    });
  }
}

module.exports = goe_charger_home_plus;
