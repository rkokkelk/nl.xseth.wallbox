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

        return {
            name: 'Go-e Charger Home+ '+goecharger.sse,
            ip: this._ip,
            serialNumber: goecharger.sse,
            onoff: alw,
            measure_power: goecharger.nrg[11]/100,
            measure_current: (goecharger.nrg[7]+goecharger.nrg[8]+goecharger.nrg[9])/10,
            measure_voltage: goecharger.nrg[0]+goecharger.nrg[1]+goecharger.nrg[2],
            measure_temperature: Number(goecharger.tmp),
            meter_power: +meter_power.toFixed(2),
            status: status,
            error: err,
            charge_amp: Number(goecharger.amp),
            charge_amp_limit: Number(goecharger.ama)//,

//GET-able values:
//version = encryption B:off C:on
//rbc = reboot counter
//rbt = reboot timer
//car = STATUS 1:ready_no_car_connected 2:car_charging 3:waiting_for_car_to_approve 4:charing_finished_car_still_connected
//err = ERROR code 1:RCCB 3:phase_error 8:no_ground_error 10:other
//cbl
//pha
//tmp
//dws
//adi
//uby
//eto
//wst
//nrg
//fwv
//sse
//eca
//ecr
//ecd
//ec4
//ec5
//ec6
//ec7
//ec8
//ec9
//ec1
//rca
//rcr
//rcd
//rc4
//rc5
//rc6
//rc7
//rc8
//rc9
//rc1

//SET-able values:
//amp = AMPERE value for Charging 6-32 (max AMP limited by ama) (CHANGE THIS FOR LOAD BALANCING PURPOSES)
//ast = ACCESS STATE 0:open_anyone_can_charge 1:RFID_or_APP_required_to_open 2:powerprice_or_automatic
//alw
//stp
//dwo
//wss
//wke
//wen
//tof
//tds
//lbr
//aho
//afi}
//ama = AMPERE absolute max value (!! DANGER DO NOT INCREASE THIS UNLESS YOU'RE CERTAIN THE HOME INFRASTRUCTURE CAN SUPPORT IT)
//al1
//al2
//al3
//al4
//al5
//cid
//cch
//cfi
//lse
//ust
//wak
//r1x
//dto
//nmo
//rna
//rnm
//rne
//rn4
//rn5
//rn6
//rn7
//rn8
//rn9
//rn1
        };
    }

    //states

    async _postToGoECharger(values) {
        try {
            console.log('values: ' + values);
            console.log('POST to: /mqtt?payload=');
            const res = await Fetch('http://' + this._ip + '/mqtt?payload=' + values, {method: 'GET'});
            if (res.status === 200) {
                return Promise.resolve(res);
            } else {
                return Promise.reject(res);
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
