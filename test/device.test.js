'use strict';

// Run with: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

// device.js needs the Homey SDK, which only exists on a Homey
const load = Module._load;
Module._load = function(request, ...args) {
  if (request === 'homey')
    return { Device: class {} };
  return load.call(this, request, ...args);
};
const Device = require('../drivers/wallbox/device');
Module._load = load;

// No real timers for the quick status poll after a change
test.beforeEach(t => t.mock.timers.enable({ apis: ['setTimeout'] }));

// Device with a mocked Wallbox API, records API calls in order
function setup(caps = {}, maxAmp = 32) {
  const values = { evcharger_charging: false, status: 'Paused', target_power: null, target_power_mode: null, ...caps };
  const calls = [];
  const device = new Device();
  device.getCapabilityValue = id => (id in values ? values[id] : null);
  device.log = () => {};
  device.poll = async () => {};
  device.homey = { __: key => key };
  device._id = 'charger';
  device._max_amp = maxAmp;
  device._api = {
    setMaxChargingCurrent: async (id, amps) => { calls.push(['setMaxChargingCurrent', amps]) },
    resumeCharging: async () => { calls.push(['resumeCharging']) },
    pauseCharging: async () => { calls.push(['pauseCharging']) }
  };
  return { device, calls };
}

const charging = { evcharger_charging: true, status: 'Charging' };

test('start while paused, no target power: resume, current untouched', async () => {
  const { device, calls } = setup();
  await device.changePower({ evcharger_charging: true });
  assert.deepStrictEqual(calls, [['resumeCharging']]);
});

test('start while paused, stored target power 7360 W (homey): current, then resume', async () => {
  const { device, calls } = setup({ target_power: 7360, target_power_mode: 'homey' });
  await device.changePower({ evcharger_charging: true });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 32], ['resumeCharging']]);
});

test('start with target power in the same batch', async () => {
  const { device, calls } = setup();
  await device.changePower({ evcharger_charging: true, target_power: 3680 });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 16], ['resumeCharging']]);
});

test('start: stored target power only counts in homey mode', async () => {
  for (const mode of [null, 'device']) {
    const { device, calls } = setup({ target_power: 7360, target_power_mode: mode });
    await device.changePower({ evcharger_charging: true });
    assert.deepStrictEqual(calls, [['resumeCharging']], `mode ${mode}`);
  }
});

test('start: current kept within 6 A and the charger maximum', async () => {
  let { device, calls } = setup({}, 16);
  await device.changePower({ evcharger_charging: true, target_power: 7360 });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 16], ['resumeCharging']]);

  ({ device, calls } = setup());
  await device.changePower({ evcharger_charging: true, target_power: 690 });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 6], ['resumeCharging']]);
});

test('start while already charging: no resume', async () => {
  const { device, calls } = setup(charging);
  await device.changePower({ evcharger_charging: true });
  assert.deepStrictEqual(calls, []);
});

test('start without car: no vehicle error', async () => {
  const { device } = setup({ status: 'Ready' });
  device._api.resumeCharging = async () => { throw new Error('403') };
  await assert.rejects(device.changePower({ evcharger_charging: true }), /errors.no_car/);
});

test('stop: pause', async () => {
  const { device, calls } = setup(charging);
  await device.changePower({ evcharger_charging: false });
  assert.deepStrictEqual(calls, [['pauseCharging']]);
});

test('target power while charging: current only', async () => {
  const { device, calls } = setup(charging);
  await device.changePower({ target_power: 3680 });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 16]]);
});

test('target power 0 while charging: pause', async () => {
  const { device, calls } = setup(charging);
  await device.changePower({ target_power: 0 });
  assert.deepStrictEqual(calls, [['pauseCharging']]);
});

test('target power below 6 A while charging: pause', async () => {
  const { device, calls } = setup(charging);
  await device.changePower({ target_power: 1000 });
  assert.deepStrictEqual(calls, [['pauseCharging']]);
});

test('target power while paused: kept for later', async () => {
  const { device, calls } = setup();
  await device.changePower({ target_power: 7360, target_power_mode: 'homey' });
  assert.deepStrictEqual(calls, []);
});
