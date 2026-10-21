import { DEVICE_POLL_FREQUENCIES } from '@gladysassistant/integration-sdk';
import { asekoPool } from './asekoPool.js';

export const DEVICE_BLUEPRINTS = [asekoPool];
export const SCENE_TRIGGER_KEYS = [];

export async function buildDiscoveredDevices(gladys, config) {
  const devices = await Promise.all(
    DEVICE_BLUEPRINTS.map((blueprint) => blueprint.buildDevices(gladys, config)),
  );
  return devices.flat();
}

export function findBlueprintByDevice(gladys, device) {
  return DEVICE_BLUEPRINTS.find((blueprint) => blueprint.ownsDevice(gladys, device));
}

const POLL_TOLERANCE_MS = DEVICE_POLL_FREQUENCIES.EVERY_MINUTES / 2;

export function createPoller() {
  const lastReads = new Map();
  return async function pollDevice(gladys, device, config) {
    const blueprint = findBlueprintByDevice(gladys, device);
    if (!blueprint || typeof blueprint.onPoll !== 'function') return false;
    const now = Date.now();
    const lastRead = lastReads.get(device.external_id);
    if (
      lastRead !== undefined &&
      now - lastRead < config.poll_frequency * 1000 - POLL_TOLERANCE_MS
    ) {
      return false;
    }
    await blueprint.onPoll(gladys, config, device);
    lastReads.set(device.external_id, now);
    return true;
  };
}
