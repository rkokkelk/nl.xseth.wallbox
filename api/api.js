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

        //voorbewerken van de variabelen als die niet 1-op-1 te gebruiken zijn
        //allow
        var alw = true;
          if(goecharger.alw==='0') { alw = false; } else {
            if (goecharger.alw==='1') { alw = true; } else {
              alw = false;
          }}
        //error
        var err = false;
        if(goecharger.err==='0') {err = false;} else {err = true;}
        //status (car)
        var status = "statusstring";
        switch (goecharger.car) {
          case '1': status = "Ready to connect car"
            break;
          case '2': status = "Charging car"
            break;
          case '3': status = "Car connected, waiting for car data"
            break;
          case '4': status = "Charging finished"
            break;
          default: status = "Ready to connect car"
        }

        var meter_power = goecharger.dws*0.00000277;
        var measure_current = (goecharger.nrg[4]+goecharger.nrg[5]+goecharger.nrg[6])/30;

        return {
            name: 'Go-e Charger Home+ '+goecharger.sse,
            ip: this._ip,
            serialNumber: goecharger.sse,
            onoff: alw,
            measure_power: goecharger.nrg[11]/100,
            measure_current: +measure_current.toFixed(2),
            measure_voltage: goecharger.nrg[0]+goecharger.nrg[1]+goecharger.nrg[2],
            measure_temperature: Number(goecharger.tmp),
            meter_power: +meter_power.toFixed(2),
            status: status,
            error: err,
            charge_amp: Number(goecharger.amp),
            charge_amp_limit: Number(goecharger.ama)//,

        };
    }

    //states

    async onoff(vlw) {
        return await this._postToGoECharger('alw='+vlw);
    }

    async _postToGoECharger(value) {
        try {
            console.log('POST: http://' + this._ip + '/mqtt?payload=' + value);
            const res = await Fetch('http://' + this._ip + '/mqtt?payload=' + value, {method: 'GET'});
            if (res.status === 200) {
                return Promise.resolve(res);
                console.log('result: '+ res);
            } else {
                return Promise.reject(res);
                console.log('result: '+ res);
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
            } else {
                return Promise.reject(res);
            }
        } catch (e) {
            return (e);
        }
    };

};
