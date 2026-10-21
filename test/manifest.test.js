import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEVICE_BLUEPRINTS } from '../src/devices/index.js';
import { asekoPool } from '../src/devices/asekoPool.js';
import { DEFAULT_CONFIG } from '../src/config.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('manifest names the public ASEKO integration and matches the package release', () => {
  assert.equal(manifest.name, 'ASEKO Pool');
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.docker_image, 'ghcr.io/esortho/gladys-aseko-pool:' + manifest.version);
  assert.equal(manifest.type, 'device');
  assert.match(manifest.gladys_version, /^>=\s*5\.1\.0/);
});

test('the ASEKO API key uses Gladys secret configuration', () => {
  const apiKey = manifest.config_schema.find((field) => field.key === 'api_key');
  assert.ok(apiKey);
  assert.equal(apiKey.type, 'secret');
  assert.equal(apiKey.required, true);
  assert.equal(DEFAULT_CONFIG.api_key, '');
});

test('the declared refresh interval matches runtime defaults and limits', () => {
  const poll = manifest.config_schema.find((field) => field.key === 'poll_frequency');
  assert.equal(poll.default, DEFAULT_CONFIG.poll_frequency);
  assert.equal(poll.min, 60);
  assert.equal(poll.max, 3600);
});

test('the integration exposes no writable actions or actuator handlers', () => {
  assert.equal(manifest.actions, undefined);
  assert.equal(manifest.scene_actions, undefined);
  assert.equal(typeof asekoPool.onSetValue, 'undefined');
  assert.equal(DEVICE_BLUEPRINTS.length, 1);
});

test('English and French documentation are present', async () => {
  const en = await readFile(new URL('../docs/en.md', import.meta.url), 'utf8');
  const fr = await readFile(new URL('../docs/fr.md', import.meta.url), 'utf8');
  assert.match(en, /read-only/i);
  assert.match(fr, /lecture seule/i);
});
