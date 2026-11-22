'use strict';

// Run with: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const { PhaseMeter } = require('../lib/phases');

// Feed polls: [status, set amps, kW]
function feed(meter, polls) {
  for (const [status, amps, kw] of polls) meter.update(status, amps, kw);
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
  assert.strictEqual(feed(meter, [['Charging', 6, 4.6598]]), 1, 'one poll is not enough');
  assert.strictEqual(feed(meter, [['Charging', 6, 4.0255]]), 3);
  assert.strictEqual(meter.last, 3);
});

test('1-phase car: 1.37 kW at 6 A', () => {
  assert.strictEqual(feed(new PhaseMeter(3), [['Charging', 6, 1.37], ['Charging', 6, 1.37]]), 1);
});

test('2-phase car: 2.7 kW at 6 A', () => {
  assert.strictEqual(feed(new PhaseMeter(), [['Charging', 6, 2.7], ['Charging', 6, 2.7]]), 2);
});

test('set current changed between polls: no reading', () => {
  // Stale power after 16 A -> 6 A on a 1-phase car would look like 2.7 phases
  assert.strictEqual(feed(new PhaseMeter(), [['Charging', 16, 3.68], ['Charging', 6, 3.68]]), 1);
});

test('reading capped at 3 phases', () => {
  assert.strictEqual(feed(new PhaseMeter(), [['Charging', 6, 6], ['Charging', 6, 6]]), 3);
});

test('tapering and a switch to 1 phase keep the session value', () => {
  const meter = new PhaseMeter();
  feed(meter, [['Charging', 16, 11], ['Charging', 16, 11]]);
  assert.strictEqual(meter.phases, 3);
  assert.strictEqual(feed(meter, [['Charging', 16, 3.6], ['Charging', 16, 3.6], ['Charging', 16, 1.2], ['Charging', 16, 1.2]]), 3);
});

test('unplug: back to the last session until the next car is measured', () => {
  const meter = new PhaseMeter();
  feed(meter, [['Charging', 6, 4.03], ['Charging', 6, 4.03]]);
  assert.strictEqual(feed(meter, [['Ready', 6, 0], ['Waiting', 6, 0]]), 3, 'last session');
  assert.strictEqual(feed(meter, [['Charging', 6, 1.37], ['Charging', 6, 1.37]]), 1, '1-phase car replaces it');
  assert.strictEqual(meter.last, 1);
});

test('paused between polls: needs two new readings', () => {
  const meter = new PhaseMeter();
  assert.strictEqual(feed(meter, [['Charging', 6, 4.03], ['Paused', 6, 0], ['Charging', 6, 4.03]]), 1);
  assert.strictEqual(feed(meter, [['Charging', 6, 4.03]]), 3);
});

test('ignored: below 6 A, below 1 kW, other statuses', () => {
  assert.strictEqual(feed(new PhaseMeter(), [['Charging', 3, 2.07], ['Charging', 3, 2.07]]), 1);
  assert.strictEqual(feed(new PhaseMeter(), [['Charging', 6, 0.5], ['Charging', 6, 0.5]]), 1);
  assert.strictEqual(feed(new PhaseMeter(), [['Discharging', 6, 4.03], ['Discharging', 6, 4.03]]), 1);
});
