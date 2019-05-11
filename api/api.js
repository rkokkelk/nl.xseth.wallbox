const Fetch = require('node-fetch');

module.exports = class goechargerApi {
    constructor(ip) {
        this._ip = ip;
    }
    //api settings
    setIp(ip) {
        this._ip = ip;
    }

    //config
    async getInfo() {
        const res = await this._getFromGoECharger('/status');
        const txt = await res.text();
        const goecharger = JSON.parse(txt);
        var alw = true;
          if(goecharger.alw==='0') { alw = false; } else {
            if (goecharger.alw==='1') { alw = true; } else {
              alw = false;
          }}
        return {
            name: 'Go-e Charger '+goecharger.sse,
            ip: this._ip,
            serialNumber: goecharger.sse,
            onoff: alw,
            measure_power: goecharger.nrg[11]/100,
            measure_current: (goecharger.nrg[7]+goecharger.nrg[8]+goecharger.nrg[9])/10,
            measure_voltage: goecharger.nrg[0]+goecharger.nrg[1]+goecharger.nrg[2],
            measure_temperature: Number(goecharger.tmp),
            meter_power: goecharger.dws*0.00000277
        };
    }

    /**async getData(){
      const res = await this._getFromGoECharger('/status');
      const txt = await res.text();
      const goecharger = JSON.parse(txt);
      return {
        onoff: goecharger.alw,
        measure_power: goecharger.nrg[11]/100,
        measure_current: (goecharger.nrg[7]+goecharger.nrg[8]+goecharger.nrg[9])/10,
        measure_voltage: goecharger.nrg[0]+goecharger.nrg[1]+goecharger.nrg[2],
        measure_temperature: goecharger.tmp,
        meter_power: goecharger.dws*0.00000277,
      }
    }**/

    //states

    async _postToGoECharger(uri, body) {
        try {
            console.log('POST to: ' + uri);
            console.log('BODY: '+ body);
            const res = await Fetch('http://' + this._ip + uri, {method: 'POST', body: body});
            if (res.status === 200) {
                return Promise.resolve();
            } else {
                return Promise.reject();
            }
        } catch (e) {
            return(e);
        }
    };
    async _getFromGoECharger(uri) {
        try {
            const res = await Fetch('http://' + this._ip + uri, {method: 'GET'});
            if (res.status === 200) {
                return Promise.resolve(res);
                //console.log(res);
            } else {
                return Promise.reject(res);
            }
        } catch (e) {
            return (e);
        }
    };

};
