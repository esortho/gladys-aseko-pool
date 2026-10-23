import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_BLUEPRINTS,
  buildDiscoveredDevices,
  createPoller,
  findBlueprintByDevice,
} from '../src/devices/index.js';
import { asekoPool } from '../src/devices/asekoPool.js';
import { normalizeConfig } from '../src/config.js';

const config = normalizeConfig({ api_key: 'not-a-real-test-key', poll_frequency: 300 });
const unit = {
  name: 'Garden pool',
  serialNumber: 'aseko-123',
  online: true,
  statusValues: {
    filtrationRunning: true,
    waterTemperature: 27.4,
    airTemperature: 24.1,
    solarTemperature: 36.1,
    ph: 7.2,
    phRequired: 7.3,
    redox: 680,
    redoxRequired: 750,
    filterPressure: 0.8,
    filterFlowSpeed: 12.5,
    waterLevel: 45,
    poolFlow: 'BOTTOM',
    heatingRunning: false,
    upcomingFiltrationPeriod: { isNonstop: false, isNext: true, start: '10:00', end: '18:00' },
    clFree: null,
  },
  statusMessages: [],
};

function mockAseko(t, detail = unit) {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('/paired-units?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ name: detail.name, serialNumber: detail.serialNumber, online: detail.online }],
          totalItems: 1,
        }),
      };
    }
    return { ok: true, status: 200, json: async () => detail };
  });
  return requests;
}

test('ASEKO discovery creates only read-only devices and features', async (t) => {
  const requests = mockAseko(t);
  const gladys = createFakeGladys();
  const devices = await buildDiscoveredDevices(gladys, config);
  assert.equal(DEVICE_BLUEPRINTS.length, 1);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].name, 'Garden pool');
  assert.equal(devices[0].should_poll, true);
  assert.equal(devices[0].poll_frequency, DEVICE_POLL_FREQUENCIES.EVERY_MINUTES);
  assert.ok(devices[0].features.every((feature) => feature.read_only === true));
  assert.ok(devices[0].features.every((feature) => feature.has_feedback === false));
  for (const feature of devices[0].features) {
    assert.ok(Number.isFinite(feature.min), feature.name + ' must have a numeric minimum');
    assert.ok(Number.isFinite(feature.max), feature.name + ' must have a numeric maximum');
    assert.ok(feature.min < feature.max, feature.name + ' minimum must be below maximum');
  }
  const poolFlowMode = devices[0].features.find((feature) => feature.name === 'Pool flow mode');
  assert.equal(poolFlowMode.min, 0);
  assert.equal(poolFlowMode.max, 1);
  const pump = devices[0].features.find((feature) => feature.name === 'Filtration pump');
  assert.ok(pump);
  assert.equal(pump.category, DEVICE_FEATURE_CATEGORIES.INPUT);
  assert.equal(pump.type, DEVICE_FEATURE_TYPES.INPUT.BINARY);
  const flow = devices[0].features.find((feature) => feature.name === 'Filter flow speed');
  assert.equal(flow.category, DEVICE_FEATURE_CATEGORIES.VOLUME_SENSOR);
  assert.equal(flow.type, DEVICE_FEATURE_TYPES.VOLUME_SENSOR.DECIMAL);
  assert.equal(flow.unit, DEVICE_FEATURE_UNITS.CUBIC_METER_PER_HOUR);
  const numericFeatures = devices[0].features.filter((feature) =>
    [
      'Water temperature',
      'Air temperature',
      'Solar temperature',
      'pH',
      'Target pH',
      'Redox',
      'Target redox',
      'Filter pressure',
      'Filter flow speed',
      'Water level (cm)',
    ].includes(feature.name),
  );
  assert.equal(numericFeatures.length, 10);
  for (const feature of numericFeatures) {
    assert.ok(Number.isFinite(feature.min), feature.name + ' must have a numeric minimum');
    assert.ok(Number.isFinite(feature.max), feature.name + ' must have a numeric maximum');
    assert.ok(feature.min < feature.max, feature.name + ' minimum must be below maximum');
  }
  const waterTemperature = numericFeatures.find((feature) => feature.name === 'Water temperature');
  assert.equal(waterTemperature.min, -10);
  assert.equal(waterTemperature.max, 60);
  assert.equal(pump.read_only, true);
  assert.equal(typeof asekoPool.onSetValue, 'undefined', 'the integration registers no actuator');
  assert.ok(requests.every((request) => request.options.method === 'GET'));

  const fresh = createFakeGladys();
  await fresh.publishDiscoveredDevices(devices);
  assert.equal(fresh.fake.discoveredDevices.length, 1);
});

test('polling publishes numeric, binary and text status without null values', async (t) => {
  mockAseko(t);
  const gladys = createFakeGladys();
  const devices = await buildDiscoveredDevices(gladys, config);
  const device = devices[0];
  const pollDevice = createPoller();
  assert.equal(await pollDevice(gladys, device, config), true);

  const ids = gladys.externalIds('aseko-pool', unit.serialNumber);
  assert.equal(gladys.fake.lastState(ids.feature('filtrationRunning')), 1);
  assert.equal(gladys.fake.lastState(ids.feature('waterTemperature')), 27.4);
  assert.equal(gladys.fake.lastState(ids.feature('ph')), 7.2);
  assert.equal(
    devices[0].features.some((feature) => feature.name === 'Free chlorine (mg/l)'),
    false,
    'unsupported generic numeric values are not exposed as an invalid Gladys data feature',
  );
  assert.equal(gladys.fake.lastState(ids.feature('online'), true), 'Online');
  assert.equal(
    gladys.fake.lastState(ids.feature('statusMessages'), true),
    'No active status messages',
  );
});

test('the refresh interval throttles repeated polls', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const requests = mockAseko(t);
  const gladys = createFakeGladys();
  const device = (await buildDiscoveredDevices(gladys, config))[0];
  const pollDevice = createPoller();
  assert.equal(await pollDevice(gladys, device, config), true);
  const firstPollRequestCount = requests.length;
  assert.equal(await pollDevice(gladys, device, config), false);
  assert.equal(requests.length, firstPollRequestCount);
  t.mock.timers.tick(5 * DEVICE_POLL_FREQUENCIES.EVERY_MINUTES);
  assert.equal(await pollDevice(gladys, device, config), true);
});

test('unknown devices are not routed to the ASEKO blueprint', () => {
  assert.equal(
    findBlueprintByDevice(createFakeGladys(), { external_id: 'other-device' }),
    undefined,
  );
});

test('empty or unsupported telemetry stays read-only and can be discovered', async (t) => {
  const offline = {
    name: 'Offline pool',
    serialNumber: 'offline-1',
    online: false,
  };
  mockAseko(t, offline);
  const devices = await buildDiscoveredDevices(createFakeGladys(), config);
  assert.equal(devices.length, 1);
  assert.ok(devices[0].features.every((feature) => feature.read_only));
  assert.deepEqual(
    devices[0].features
      .map((feature) => feature.name)
      .filter((name) => ['Filtration pump', 'Water temperature'].includes(name))
      .sort(),
    ['Filtration pump', 'Water temperature'],
  );
});
