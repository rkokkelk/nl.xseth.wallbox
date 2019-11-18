# Go-e Charger app for Homey Athom
Adds support for the Go-e car Charger to the Homey Athom.
* *Version*: 0.3.2 (beta)

## About the Go-e Charger
The Go-e Charger is a mobile car charger for type 2 charging cable, enabling up to 22kW charging. The Go-e Charger is mobile, it's connecable to a wide variety of sockets so it can be both your 'granny charger' and your wallbox depending on the power that's available at the charging location.

### Features
* readout of values: *current power*, *current amperage*, *current voltage*, *current temperature*, *error status*, *power meter per session* and *max amperage as set for the device*
* allow charging via on/off toggle via Homey
* flow trigger cards for: *charging finished* and *car connected*
* flow action cards for: *changing amperage* and *allow / disallow charging*
* flow condition cards for: *car connected* and *charging in progress*

#### Setup
The homey app for the Go-e Charger Home+ allows only for local IP connection and does not yet support cloud connections. For most uses the local ip function is sufficient. Connect your go-e charger to the same wireless network as the Homey athom, and give it a fixed ip address. Next add the go-e charger to the Homey and enter the ip address and you're good to go.

### DEVICES
#### Go-e Charger Home+:
* [homepage](https://go-e.co/en/go-echarger-home/)
* [manual](https://go-e.co/wp-content/uploads/2019/04/Handbuch-B2C-Charger_EN-1.0-003-1.pdf)
* [api reference](https://go-e.co/app/api.pdf)

#### Go-e Charger Pro (not yet available):
* [homepage](https://go-e.co/en/go-echarger-pro/)

### Special thanks to:
* [abaretta](https://github.com/abaretta),
* [biemond](https://github.com/biemond), and
* [StefanSimon](https://gitlab.com/StefanSimon)

...for being able to view their app code and learning from it.

and
* [peltsi51](https://community.athom.com/u/peltsi51)
...for helping me test the app.
