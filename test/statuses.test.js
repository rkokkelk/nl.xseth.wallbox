'use strict';

// Run with: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const statusUtil = require('../lib/statuses');

// status_id -> [status, evcharger_charging_state]
const expected = {
  0: ['Disconnected', 'plugged_out'],
  163: ['Disconnected', 'plugged_out'],
  14: ['Error', 'plugged_out'],
  15: ['Error', 'plugged_out'],
  161: ['Ready', 'plugged_out'],
  162: ['Ready', 'plugged_out'],
  164: ['Waiting', 'plugged_in'],
  165: ['Locked', 'plugged_out'],
  166: ['Updating', 'plugged_out'],
  177: ['Waiting', 'plugged_in'],
  179: ['Waiting', 'plugged_in'],
  178: ['Paused', 'plugged_in_paused'],
  182: ['Paused', 'plugged_in_paused'],
  180: ['Waiting', 'plugged_in'],
  181: ['Waiting', 'plugged_in'],
  183: ['Waiting', 'plugged_in'],
  184: ['Waiting', 'plugged_in'],
  185: ['Waiting', 'plugged_in'],
  186: ['Waiting', 'plugged_in'],
  187: ['Waiting', 'plugged_in'],
  188: ['Waiting', 'plugged_in'],
  189: ['Waiting', 'plugged_in'],
  193: ['Charging', 'plugged_in_charging'],
  194: ['Charging', 'plugged_in_charging'],
  195: ['Charging', 'plugged_in_charging'],
  196: ['Discharging', 'plugged_in_discharging'],
  209: ['Locked', 'plugged_out'],
  210: ['LockedCarConnected', 'plugged_in_paused']
};

for (const [statusId, [status, chargingState]] of Object.entries(expected))
  test(`status_id ${statusId} maps to ${status} / ${chargingState}`, () => {
    const actual = statusUtil.getStatus(Number(statusId));
    assert.strictEqual(actual, status);
    assert.strictEqual(statusUtil.getChargingState(actual), chargingState);
  });

test('every status has a charging state', () => {
  for (const status of Object.keys(statusUtil.statuses))
    assert.ok(statusUtil.getChargingState(status), status);
});

test('every status is a value of the status capability', () => {
  const capability = require('../.homeycompose/capabilities/status.json');
  const ids = capability.values.map(value => value.id);
  for (const status of Object.keys(statusUtil.statuses))
    assert.ok(ids.includes(status), status);
});
