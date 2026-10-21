import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPairedUnit, getPairedUnits } from '../src/aseko-api.js';

const config = { api_key: 'not-a-real-test-key' };
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

function pairedUnit(serialNumber) {
  return { serialNumber, online: true, name: 'Pool ' + serialNumber };
}

test('getPairedUnits sends the documented auth and client headers and paginates', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: String(url), options });
    const page = Number(new URL(url).searchParams.get('page'));
    const items =
      page === 1
        ? Array.from({ length: 10 }, (_, index) => pairedUnit('unit-' + index))
        : [pairedUnit('unit-10')];
    return response({ items, totalItems: 11 });
  });

  const units = await getPairedUnits(config);
  assert.equal(units.length, 11);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer not-a-real-test-key');
  assert.equal(requests[0].options.headers['X-Client-Name'], 'Gladys ASEKO Pool');
  assert.equal(requests[0].options.headers['X-Client-Version'], '1.0.0');
  assert.equal(new URL(requests[1].url).searchParams.get('page'), '2');
});

test('getPairedUnit URL-encodes the serial number and validates the response', async (t) => {
  let requestedUrl;
  t.mock.method(globalThis, 'fetch', async (url) => {
    requestedUrl = String(url);
    return response({ serialNumber: 'serial/one', online: false, statusValues: {} });
  });
  const unit = await getPairedUnit('serial/one', config);
  assert.equal(unit.online, false);
  assert.match(requestedUrl, /serial%2Fone$/);
});

test('provider errors are useful without exposing the API key', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response({ error: 'private response' }, 401));
  await assert.rejects(getPairedUnits(config), (error) => {
    assert.match(error.message, /HTTP 401/);
    assert.doesNotMatch(error.message, /not-a-real-test-key/);
    return true;
  });
});

test('rate limits are surfaced for the next scheduled retry', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response({}, 429));
  await assert.rejects(getPairedUnits(config), /rate limit.*429/i);
});

test('missing credentials and malformed API responses fail closed', async (t) => {
  await assert.rejects(getPairedUnits({}), /API key is not configured/);
  t.mock.method(globalThis, 'fetch', async () =>
    response({ items: 'not-an-array', totalItems: 1 }),
  );
  await assert.rejects(getPairedUnits(config), /invalid paired-units response/);
});
