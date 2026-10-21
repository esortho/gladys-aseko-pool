import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, DEFAULT_CONFIG } from '../src/config.js';

test('normalizeConfig returns safe defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.equal(DEFAULT_CONFIG.api_key, '');
  assert.equal(DEFAULT_CONFIG.poll_frequency, 300);
});

test('normalizeConfig trims the secret and normalizes the interval', () => {
  const config = normalizeConfig({ api_key: ' key-from-test ', poll_frequency: '600' });
  assert.equal(config.api_key, 'key-from-test');
  assert.equal(config.poll_frequency, 600);
  assert.equal(typeof config.poll_frequency, 'number');
});

test('normalizeConfig does not coerce missing or invalid API keys into values', () => {
  assert.equal(normalizeConfig({ api_key: 123 }).api_key, '');
  assert.equal(normalizeConfig({}).api_key, '');
});

test('normalizeConfig rejects out-of-range poll intervals', () => {
  assert.equal(
    normalizeConfig({ poll_frequency: 59 }).poll_frequency,
    DEFAULT_CONFIG.poll_frequency,
  );
  assert.equal(
    normalizeConfig({ poll_frequency: 3601 }).poll_frequency,
    DEFAULT_CONFIG.poll_frequency,
  );
  assert.equal(
    normalizeConfig({ poll_frequency: 'not-a-number' }).poll_frequency,
    DEFAULT_CONFIG.poll_frequency,
  );
});
