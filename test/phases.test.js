'use strict';

// Run with: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const { PhaseMeter } = require('../lib/phases');

// Feed polls: [status, set amps, kW, time in s]
function feed(meter, polls) {
  for (const [status, amps, kw, s] of polls) meter.update(status, amps, kw, s * 1000);
  return meter.phases;
}

test('unknown: 1 phase (as before), else the last session', () => {
  assert.strictEqual(new PhaseMeter().phases, 1);
  assert.strictEqual(new PhaseMeter(null).phases, 1);
  assert.strictEqual(new PhaseMeter(7).phases, 1);
  assert.strictEqual(new PhaseMeter(3).phases, 3);
});

test('real 3-phase session: 4.66 kW (stale), then 4.03 kW at 6 A', () => {
  const meter = new PhaseMeter();
  assert.strictEqual(feed(meter, [['Charging', 6, 4.6598, 0], ['Charging', 6, 4.0255, 10]]), 1, 'stale reading and first fit do not count');
  assert.strictEqual(feed(meter, [['Charging', 6, 4.0255, 133]]), 3);
  assert.strictEqual(meter.last, 3);
});

test('1-phase car: 1.37 kW at 6 A', () => {
  assert.strictEqual(feed(new PhaseMeter(3), [['Charging', 6, 1.37, 0], ['Charging', 6, 1.37, 123]]), 1);
});

test('2-phase car: 2.7 kW at 6 A', () => {
  assert.strictEqual(feed(new PhaseMeter(), [['Charging', 6, 2.7, 0], ['Charging', 6, 2.7, 123]]), 2);
});

test('two quick polls a second apart: no reading', () => {
  // Stale power after 16 A -> 6 A on a 1-phase car would look like 2.67 phases, here stale 4.14 kW
  assert.strictEqual(feed(new PhaseMeter(), [['Charging', 6, 4.14, 10], ['Charging', 6, 4.14, 11]]), 1);
});

test('set current changed between polls: no reading', () => {
  assert.strictEqual(feed(new PhaseMeter(), [['Charging', 16, 3.68, 0], ['Charging', 6, 4.14, 123]]), 1);
});

test('car draws less than the set current: no reading', () => {
  // 11 kW car (16 A x 3) on a 32 A setting: ratio 1.5
  assert.strictEqual(feed(new PhaseMeter(3), [['Charging', 32, 11.04, 0], ['Charging', 32, 11.04, 123]]), 3);
  assert.strictEqual(feed(new PhaseMeter(3), [['Charging', 32, 10.9, 0], ['Charging', 32, 10.9, 123]]), 3);
});

test('more than 3 phases (stale power): no reading', () => {
  assert.strictEqual(feed(new PhaseMeter(), [['Charging', 6, 6, 0], ['Charging', 6, 6, 123]]), 1);
});

test('tapering and a switch to 1 phase keep the session value', () => {
  const meter = new PhaseMeter();
  feed(meter, [['Charging', 16, 11, 0], ['Charging', 16, 11, 123]]);
  assert.strictEqual(meter.phases, 3);
  assert.strictEqual(feed(meter, [['Charging', 16, 3.6, 246], ['Charging', 16, 3.6, 369], ['Charging', 16, 1.2, 492], ['Charging', 16, 1.2, 615]]), 3);
});

test('unplug: back to the last session until the next car is measured', () => {
  const meter = new PhaseMeter();
  feed(meter, [['Charging', 6, 4.03, 0], ['Charging', 6, 4.03, 123]]);
  assert.strictEqual(feed(meter, [['Ready', 6, 0, 246], ['Waiting', 6, 0, 369]]), 3, 'last session');
  assert.strictEqual(meter.session, null);
  assert.strictEqual(feed(meter, [['Charging', 6, 1.37, 492], ['Charging', 6, 1.37, 615]]), 1, '1-phase car replaces it');
  assert.strictEqual(meter.last, 1);
});

test('paused between polls: needs two new readings', () => {
  const meter = new PhaseMeter();
  assert.strictEqual(feed(meter, [['Charging', 6, 4.03, 0], ['Paused', 6, 0, 123], ['Charging', 6, 4.03, 246]]), 1);
  assert.strictEqual(feed(meter, [['Charging', 6, 4.03, 369]]), 3);
});

test('ignored: below 6 A, below 1 kW, other statuses', () => {
  assert.strictEqual(feed(new PhaseMeter(), [['Charging', 3, 2.07, 0], ['Charging', 3, 2.07, 123]]), 1);
  assert.strictEqual(feed(new PhaseMeter(), [['Charging', 6, 0.5, 0], ['Charging', 6, 0.5, 123]]), 1);
  assert.strictEqual(feed(new PhaseMeter(), [['Discharging', 6, 4.03, 0], ['Discharging', 6, 4.03, 123]]), 1);
});
