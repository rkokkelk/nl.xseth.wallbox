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
        var goecharger = JSON.parse(txt);

        //preprocessing of variables which aren't usable as such
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
          case '1': status = "No car connected"
            break;
          case '2': status = "Charging car"
            break;
          case '3': status = "Car connected"
            break;
          case '4': status = "Charging finished"
            break;
          default: status = "No car connected"
        }
        //console.log(goecharger.car);

        var meter_power = goecharger.dws*0.00000277;

        //the amps should be measured over the whole of the phases.
        //if more than 1 phase is used, the amps should be devided by the number of phases
        //all amp values are devided by 10 so therefor the below calculation
        var measure_current_divider = 0;
        if(goecharger.nrg[4]>0) {measure_current_divider=measure_current_divider+10;}
        if(goecharger.nrg[5]>0) {measure_current_divider=measure_current_divider+10;}
        if(goecharger.nrg[6]>0) {measure_current_divider=measure_current_divider+10;}
        if(measure_current_divider==0) {measure_current_divider=1;}
        var measure_current = (goecharger.nrg[4]+goecharger.nrg[5]+goecharger.nrg[6])/measure_current_divider;
        //console.log("measure_current_divider:"+measure_current_divider)

        var energy_tot = 0;
        if(goecharger.eto>0) {energy_tot=goecharger.eto/10}

        return {
            name: 'Go-e Charger Home+ '+goecharger.sse,
            ip: this._ip,
            serialNumber: goecharger.sse,
            onoff: alw,
            old_onoff: alw,
            measure_power: goecharger.nrg[11]*10,
            measure_current: +measure_current.toFixed(2),
            measure_voltage: goecharger.nrg[0]+goecharger.nrg[1]+goecharger.nrg[2],
            measure_temperature: Number(goecharger.tmp),
            meter_power: +meter_power.toFixed(2),
            status: status,
            old_status: status,
            error: err,
            charge_amp: Number(goecharger.amp),
            charge_amp_limit: Number(goecharger.ama),
            energy_total: energy_tot
        }
    }

    //changing states
    async onoff(vlw) {
        return await this._postToGoECharger('alw='+vlw);
    }


    async charge_amp(vlw) {
        return await this._postToGoECharger('amp='+vlw);
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
