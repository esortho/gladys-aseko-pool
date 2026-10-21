import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { getPairedUnit, getPairedUnits } from '../aseko-api.js';

const DEVICE_TYPE = 'aseko-pool';
const recordsByExternalId = new Map();

const BINARY = (name) => ({
  name,
  category: C.INPUT,
  type: T.INPUT.BINARY,
  valueType: 'binary',
  min: 0,
  max: 1,
});
const DECIMAL = (name, category, type = T.SENSOR.DECIMAL, unit) => ({
  name,
  category,
  type,
  valueType: 'number',
  ...(unit ? { unit } : {}),
});
const TEXT = (name) => ({
  name,
  category: C.TEXT,
  type: T.TEXT.TEXT,
  valueType: 'text',
});

const STATUS_FEATURES = [
  ['filtrationRunning', BINARY('Filtration pump')],
  [
    'waterTemperature',
    DECIMAL('Water temperature', C.TEMPERATURE_SENSOR, T.SENSOR.DECIMAL, U.CELSIUS),
  ],
  ['airTemperature', DECIMAL('Air temperature', C.TEMPERATURE_SENSOR, T.SENSOR.DECIMAL, U.CELSIUS)],
  [
    'solarTemperature',
    DECIMAL('Solar temperature', C.TEMPERATURE_SENSOR, T.SENSOR.DECIMAL, U.CELSIUS),
  ],
  ['heatingRunning', BINARY('Heating')],
  ['solarRunning', BINARY('Solar heating')],
  ['waterFillingRunning', BINARY('Water filling')],
  ['electrolyzerRunning', BINARY('Electrolyzer')],
  [
    'waterFlowToProbes',
    {
      name: 'Water flow to probes',
      category: C.INPUT,
      type: T.INPUT.BINARY,
      valueType: 'binary',
      min: 0,
      max: 1,
    },
  ],
  ['ph', DECIMAL('pH', C.PH_SENSOR, T.PH_SENSOR.DECIMAL, U.PH)],
  ['phRequired', DECIMAL('Target pH', C.PH_SENSOR, T.PH_SENSOR.DECIMAL, U.PH)],
  ['redox', DECIMAL('Redox', C.ORP_SENSOR, T.ORP_SENSOR.DECIMAL, U.MILLI_VOLT)],
  ['redoxRequired', DECIMAL('Target redox', C.ORP_SENSOR, T.ORP_SENSOR.DECIMAL, U.MILLI_VOLT)],
  ['filterPressure', DECIMAL('Filter pressure', C.PRESSURE_SENSOR, T.SENSOR.DECIMAL, U.BAR)],
  [
    'filterFlowSpeed',
    DECIMAL('Filter flow speed', C.VOLUME_SENSOR, T.VOLUME_SENSOR.DECIMAL, U.CUBIC_METER_PER_HOUR),
  ],
  ['waterLevel', DECIMAL('Water level (cm)', C.LEVEL_SENSOR, T.LEVEL_SENSOR.LIQUID_DEPTH, U.CM)],
  ['mode', TEXT('Operating mode')],
  ['electrolyzerDirection', TEXT('Electrolyzer direction')],
  ['filtrationSpeed', TEXT('Filtration speed')],
  ['poolFlow', TEXT('Pool flow mode')],
  ['waterLevelState', TEXT('Water level status')],
  ['upcomingFiltrationPeriod', TEXT('Filtration schedule')],
];

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function getFeatureDefinitions(unit) {
  const values =
    unit.statusValues && typeof unit.statusValues === 'object' ? unit.statusValues : {};
  const supported = STATUS_FEATURES.filter(([key]) => hasOwn(values, key));
  // These are the two headline values the integration is intended to show.
  // Keep them visible for units that have never reported a status payload yet.
  for (const key of ['filtrationRunning', 'waterTemperature']) {
    if (!supported.some(([featureKey]) => featureKey === key)) {
      supported.push(STATUS_FEATURES.find(([featureKey]) => featureKey === key));
    }
  }
  const definitions = supported.map(([key, definition]) => ({ key, ...definition }));
  definitions.push({ key: 'online', ...TEXT('ASEKO cloud connection') });
  if (Array.isArray(unit.statusMessages)) {
    definitions.push({ key: 'statusMessages', ...TEXT('Status messages') });
  }
  return definitions;
}

function formatFiltrationPeriod(period) {
  if (!period || typeof period !== 'object') return undefined;
  if (period.isNonstop === true) return 'Non-stop';
  const times = [period.start, period.end].filter((value) => typeof value === 'string');
  if (times.length === 0) return undefined;
  return (period.isNext === true ? 'Next: ' : 'Running: ') + times.join('–');
}

function featureValue(unit, key) {
  if (key === 'online') return unit.online === true ? 'Online' : 'Offline';
  if (key === 'statusMessages') {
    const messages = Array.isArray(unit.statusMessages) ? unit.statusMessages : [];
    if (messages.length === 0) return 'No active status messages';
    return (
      messages
        .filter(
          (item) => item && typeof item.severity === 'string' && typeof item.message === 'string',
        )
        .map((item) => {
          const detail = typeof item.detail === 'string' ? ' — ' + item.detail : '';
          return item.severity + ': ' + item.message + detail;
        })
        .join('; ') || 'No active status messages'
    );
  }
  const value = unit.statusValues?.[key];
  if (key === 'upcomingFiltrationPeriod') return formatFiltrationPeriod(value);
  return value;
}

function buildDevice(gladys, unit) {
  const ids = gladys.externalIds(DEVICE_TYPE, unit.serialNumber);
  const definitions = getFeatureDefinitions(unit);
  const record = { serialNumber: unit.serialNumber, definitions };
  recordsByExternalId.set(ids.device, record);
  return {
    name:
      typeof unit.name === 'string' && unit.name.trim()
        ? unit.name.trim().slice(0, 100)
        : 'ASEKO pool ' + unit.serialNumber,
    external_id: ids.device,
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: definitions.map((definition) => ({
      name: definition.name,
      external_id: ids.feature(definition.key),
      category: definition.category,
      type: definition.type,
      ...(definition.unit ? { unit: definition.unit } : {}),
      ...(definition.min !== undefined ? { min: definition.min } : {}),
      ...(definition.max !== undefined ? { max: definition.max } : {}),
      read_only: true,
      has_feedback: false,
      ...(definition.valueType === 'text' ? {} : { keep_history: true }),
    })),
  };
}

async function fetchDevice(gladys, config, unit) {
  const details = await getPairedUnit(unit.serialNumber, config);
  return buildDevice(gladys, { ...unit, ...details });
}

export const asekoPool = {
  key: DEVICE_TYPE,

  ownsDevice(_gladys, device) {
    return recordsByExternalId.has(device.external_id);
  },

  async buildDevices(gladys, config) {
    const units = await getPairedUnits(config);
    const devices = await Promise.all(units.map((unit) => fetchDevice(gladys, config, unit)));
    const currentIds = new Set(devices.map((device) => device.external_id));
    for (const id of recordsByExternalId.keys()) {
      if (!currentIds.has(id)) recordsByExternalId.delete(id);
    }
    return devices;
  },

  async onPoll(gladys, config, device) {
    let record = recordsByExternalId.get(device.external_id);
    if (!record) {
      const units = await getPairedUnits(config);
      const unit = units.find(
        (candidate) =>
          gladys.externalIds(DEVICE_TYPE, candidate.serialNumber).device === device.external_id,
      );
      if (!unit) throw new Error('ASEKO unit is no longer paired to this account.');
      await fetchDevice(gladys, config, unit);
      record = recordsByExternalId.get(device.external_id);
    }

    const details = await getPairedUnit(record.serialNumber, config);
    const states = [];
    const ids = gladys.externalIds(DEVICE_TYPE, record.serialNumber);
    for (const definition of record.definitions) {
      const value = featureValue(details, definition.key);
      if (value === undefined || value === null) continue;
      const externalId = ids.feature(definition.key);
      if (definition.valueType === 'text') {
        if (typeof value === 'string')
          states.push({ device_feature_external_id: externalId, text: value });
      } else if (definition.valueType === 'binary') {
        if (typeof value === 'boolean')
          states.push({ device_feature_external_id: externalId, state: Number(value) });
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        states.push({ device_feature_external_id: externalId, state: value });
      }
    }
    if (states.length > 0) await gladys.publishStates(states);
  },
};
