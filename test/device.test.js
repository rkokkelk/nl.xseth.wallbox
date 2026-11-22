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
const { PhaseMeter } = require('../lib/phases');

// No real timers for the quick status poll after a change, and a fake clock
test.beforeEach(t => t.mock.timers.enable({ apis: ['setTimeout', 'Date'] }));

// Device with a mocked Wallbox API, records API calls in order.
// phases: stored phase count, measured for this car unless measured = false
function setup(caps = {}, maxAmp = 32, phases, measured = true) {
  const values = { evcharger_charging: false, status: 'Paused', target_power: null, target_power_mode: null, ...caps };
  const calls = [];
  const device = new Device();
  device.getCapabilityValue = id => (id in values ? values[id] : null);
  device.log = () => {};
  device.poll = async () => {};
  device.homey = { __: key => key };
  device._id = 'charger';
  device._max_amp = maxAmp;
  if (phases) {
    device._phases = new PhaseMeter(phases);
    if (measured)
      device._phases.session = phases;
  }
  const stored = [];
  device.setStoreValue = async (key, value) => { stored.push([key, value]) };
  device.setCapabilityOptions = (id, options) => { calls.push(['setCapabilityOptions', id, options]) };
  device.error = () => {};
  device._api = {
    setMaxChargingCurrent: async (id, amps) => { calls.push(['setMaxChargingCurrent', amps]) },
    resumeCharging: async () => { calls.push(['resumeCharging']) },
    pauseCharging: async () => { calls.push(['pauseCharging']) }
  };
  return { device, calls, values, stored };
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

test('device mode: no crash, charger left as is', async () => {
  const { device, calls } = setup(charging);
  await device.changePower({ target_power_mode: 'device' });
  assert.deepStrictEqual(calls, []);
});

test('device mode: target power ignored', async () => {
  let { device, calls } = setup({ ...charging, target_power_mode: 'device' });
  await device.changePower({ target_power: 3680 });
  assert.deepStrictEqual(calls, [], 'stored device mode');

  ({ device, calls } = setup(charging));
  await device.changePower({ target_power: 3680, target_power_mode: 'device' });
  assert.deepStrictEqual(calls, [], 'device mode in the same batch');

  ({ device, calls } = setup({ target_power_mode: 'device' }));
  await device.changePower({ evcharger_charging: true, target_power: 3680 });
  assert.deepStrictEqual(calls, [['resumeCharging']], 'start only resumes');
});

test('device mode with start in the same batch: still resumes', async () => {
  const { device, calls } = setup({ target_power: 7360, target_power_mode: 'homey' });
  await device.changePower({ target_power_mode: 'device', evcharger_charging: true });
  assert.deepStrictEqual(calls, [['resumeCharging']]);
});

test('target power while paused: current, then resume', async () => {
  const { device, calls } = setup();
  await device.changePower({ target_power: 7360, target_power_mode: 'homey' });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 32], ['resumeCharging']]);
});

test('target power while waiting (car full, queue, Eco-Smart): nothing', async () => {
  const { device, calls } = setup({ status: 'Waiting' });
  await device.changePower({ target_power: 7360, target_power_mode: 'homey' });
  await device.changePower({ target_power: 7360 });
  assert.deepStrictEqual(calls, []);
});

test('auto-start: resume refused (car gone) is logged, not thrown', async () => {
  const { device, calls } = setup({ target_power_mode: 'homey' });
  device._api.resumeCharging = async () => { calls.push(['resumeCharging']); throw new Error('403') };
  await device.changePower({ target_power: 7360 });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 32], ['resumeCharging']]);
});

test('after a resume from target power, target 0 pauses (polls not caught up yet)', async () => {
  const { device, calls } = setup({ target_power_mode: 'homey' });
  await device.changePower({ target_power: 7360 });
  await device.changePower({ target_power: 0 });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 32], ['resumeCharging'], ['pauseCharging']]);
});

test('after a pause from target power, a higher target resumes', async () => {
  const { device, calls } = setup({ ...charging, target_power_mode: 'homey' });
  await device.changePower({ target_power: 1000 });
  await device.changePower({ target_power: 7360 });
  assert.deepStrictEqual(calls, [['pauseCharging'], ['setMaxChargingCurrent', 32], ['resumeCharging']]);
});

test('start right after a pause from target power resumes', async () => {
  const { device, calls } = setup(charging);
  await device.changePower({ target_power: 0 });
  await device.changePower({ evcharger_charging: true });
  assert.deepStrictEqual(calls, [['pauseCharging'], ['resumeCharging']]);
});

test('own pause/resume counts for 3 minutes, then the polled state', async t => {
  const { device, calls, values } = setup({ target_power_mode: 'homey' });
  await device.changePower({ target_power: 7360 });
  values.status = 'Waiting'; // car never started (full)
  t.mock.timers.tick(181000);
  await device.changePower({ target_power: 7360 });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 32], ['resumeCharging']], 'no second resume');
});

test('changes run one at a time', async () => {
  const { device, calls } = setup({ target_power_mode: 'homey' });
  let release;
  device._api.setMaxChargingCurrent = async (id, amps) => {
    calls.push(['setMaxChargingCurrent', amps]);
    await new Promise(resolve => { release = resolve });
  };
  const first = device.changePower({ target_power: 7360 });
  const second = device.changePower({ target_power: 0 });
  await new Promise(resolve => setImmediate(resolve));
  release();
  await Promise.all([first, second]);
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 32], ['resumeCharging'], ['pauseCharging']]);
});

test('switch to homey mode applies the stored target power', async () => {
  const { device, calls } = setup({ ...charging, target_power: 3680, target_power_mode: 'device' });
  await device.changePower({ target_power_mode: 'homey' });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 16]]);
});

test('switch to device mode undoes a pause from target power only', async () => {
  let { device, calls } = setup({ ...charging, target_power_mode: 'homey' });
  await device.changePower({ target_power: 0 });
  await device.changePower({ target_power_mode: 'device' });
  assert.deepStrictEqual(calls, [['pauseCharging'], ['resumeCharging']], 'paused by target power');

  ({ device, calls } = setup({ ...charging, target_power_mode: 'homey' }));
  await device.changePower({ evcharger_charging: false });
  await device.changePower({ target_power_mode: 'device' });
  assert.deepStrictEqual(calls, [['pauseCharging']], 'stopped by the user');
});

test('pause from target power is stored, so device mode undoes it after a restart', async () => {
  let { device, calls, stored } = setup({ ...charging, target_power_mode: 'homey' });
  await device.changePower({ target_power: 0 });
  assert.deepStrictEqual(stored, [['targetPaused', true]]);

  // After a restart onInit reads the stored flag
  ({ device, calls } = setup({ target_power: 0, target_power_mode: 'homey' }));
  device._targetPaused = true;
  await device.changePower({ target_power_mode: 'device' });
  assert.deepStrictEqual(calls, [['resumeCharging']]);
});

test('target power without car: kept for later', async () => {
  for (const status of ['Ready', 'Locked', 'LockedCarConnected']) {
    const { device, calls } = setup({ status });
    await device.changePower({ target_power: 7360, target_power_mode: 'homey' });
    assert.deepStrictEqual(calls, [], status);
  }
});

test('target power below 6 A while paused: nothing', async () => {
  const { device, calls } = setup();
  await device.changePower({ target_power: 0 });
  await device.changePower({ target_power: 1000 });
  assert.deepStrictEqual(calls, []);
});

test('3 phases: target power to current (4140 W = 6 A, 11040 W = 16 A)', async () => {
  for (const [watts, amps] of [[4140, 6], [7360, 11], [11040, 16]]) {
    const { device, calls } = setup(charging, 16, 3);
    await device.changePower({ target_power: watts });
    assert.deepStrictEqual(calls, [['setMaxChargingCurrent', amps]], `${watts} W`);
  }
});

test('3 phases: below 4140 W while charging pauses', async () => {
  const { device, calls } = setup(charging, 16, 3);
  await device.changePower({ target_power: 3680 });
  assert.deepStrictEqual(calls, [['pauseCharging']]);
});

test('3 phases: start with stored target power 7360 W (homey)', async () => {
  const { device, calls } = setup({ target_power: 7360, target_power_mode: 'homey' }, 16, 3);
  await device.changePower({ evcharger_charging: true });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 11], ['resumeCharging']]);
});

test('poll readings: 3 phases stored, slider follows (max 11040 W, min 4140 W)', async t => {
  const { device, calls, stored } = setup(charging, 16, 1, false);
  await device.updatePhases('Charging', 6, 4.6598);
  t.mock.timers.tick(10000);
  await device.updatePhases('Charging', 6, 4.0255);
  assert.deepStrictEqual(calls, [], 'stale reading and first fit do not count');
  t.mock.timers.tick(123000);
  await device.updatePhases('Charging', 6, 4.0255);
  assert.deepStrictEqual(stored, [['phases', 3]]);
  assert.deepStrictEqual(calls, [
    ['setCapabilityOptions', 'target_power', { min: 0, max: 11040, step: 230, excludeMin: 0, excludeMax: 4140 }]
  ]);
  calls.length = 0;
  t.mock.timers.tick(123000);
  await device.updatePhases('Charging', 6, 4.0255);
  assert.deepStrictEqual(calls, [], 'no change, no update');
});

test('poll readings: a phase change re-applies the target power (homey)', async t => {
  const { device, calls } = setup({ ...charging, target_power: 7360, target_power_mode: 'homey' }, 16, 1, false);
  await device.updatePhases('Charging', 16, 11.04);
  t.mock.timers.tick(123000);
  await device.updatePhases('Charging', 16, 11.04);
  assert.deepStrictEqual(calls.filter(c => c[0] === 'setMaxChargingCurrent'), [['setMaxChargingCurrent', 11]]);
});

test('3 phases stored, car not measured yet: 1-phase minimum, so it can start', async () => {
  const { device, calls } = setup({ target_power_mode: 'homey' }, 16, 3, false);
  await device.changePower({ target_power: 3000 });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 6], ['resumeCharging']]);
});

test('slider: max from the stored phases, minimum from the measured ones', async () => {
  const { device, calls } = setup({}, 16, 3, false);
  await device.updateOptions();
  assert.deepStrictEqual(calls, [['setCapabilityOptions', 'target_power', { min: 0, max: 11040, step: 230, excludeMin: 0, excludeMax: 1380 }]]);
});

test('no reading yet: 1 phase, as before', async () => {
  const { device, calls } = setup(charging, 16);
  await device.changePower({ target_power: 3680 });
  assert.deepStrictEqual(calls, [['setMaxChargingCurrent', 16]]);
});
