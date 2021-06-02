# Wallbox Charger app for Homey Athom
Adds support for the Wallbox car Charger to the Homey Athom.

## About the Wallbox Charger
The Wallbox Charger is a mobile car charger, enabling up to 22kW charging.

### Features
* readout of values: *current power*, *current amperage*, *current voltage*, *current temperature*, *error status*, *power meter per session* and *max amperage as set for the device*
* allow charging via on/off toggle via Homey
* flow trigger cards for: *charging finished* and *car connected*
* flow action cards for: *changing amperage* and *allow / disallow charging*
* flow condition cards for: *car connected* and *charging in progress*

#### Setup
The homey app for the Wallbox only supports cloud connections. Connect your Wallbox charger to a network with internet connectivity. Next add the Wallbox charger to the Homey and enter the your Wallbox credentials.

## Special thanks to:
* [Phatenl](https://github.com/phatenl/nl.phate.goecharger)

...for being able to view their app code and learning from it.
