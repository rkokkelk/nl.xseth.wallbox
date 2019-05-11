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
        return {
            name: 'Go-e Charger '+goecharger.sse,
            ip: this._ip,
            serialNumber: goecharger.sse
        };
    }

    async getData(){
      const res = await this._getFromGoECharger('/status');
      const txt = await res.text();
      const goecharger = JSON.parse(txt);
      return {


      }
    }

    //states
/**    async isOn() {
        try {
            const res = await this._getFromSoundtouch('/now_playing');
            const body = await res.text();
            const jsObj = await this._parseXML(body);
            return (jsObj.nowPlaying.$.source !== 'STANDBY');
        } catch (e) {
            return Promise.reject(e);
        }
    }
**/


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
