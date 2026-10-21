import packageJson from '../package.json' with { type: 'json' };

const API_BASE_URL = 'https://api.aseko.cloud/api/v1';
const CLIENT_NAME = 'Gladys ASEKO Pool';
const CLIENT_VERSION = packageJson.version;
const PAGE_SIZE = 10;
const MAX_PAGES = 100;
const REQUEST_TIMEOUT_MS = 15000;

async function request(path, config) {
  const apiKey = typeof config?.api_key === 'string' ? config.api_key.trim() : '';
  if (!apiKey) {
    throw new Error('ASEKO API key is not configured.');
  }

  let response;
  try {
    response = await fetch(API_BASE_URL + path, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'X-Client-Name': CLIENT_NAME,
        'X-Client-Version': CLIENT_VERSION,
        'Accept-Language': 'en',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error('ASEKO API request timed out.', { cause: error });
    }
    throw new Error('Could not reach the ASEKO API.', { cause: error });
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        'ASEKO rejected the API key (HTTP 401). Check the key and accepted terms of service.',
      );
    }
    if (response.status === 403) {
      throw new Error(
        'ASEKO denied the request (HTTP 403). Check account permissions and terms of service.',
      );
    }
    if (response.status === 429) {
      throw new Error(
        'ASEKO API rate limit reached (HTTP 429); the next scheduled poll will retry.',
      );
    }
    throw new Error('ASEKO API request failed (HTTP ' + response.status + ').');
  }

  try {
    return await response.json();
  } catch {
    throw new Error('ASEKO API returned invalid JSON.');
  }
}

export async function getPairedUnits(config) {
  const units = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await request('/paired-units?page=' + page + '&limit=' + PAGE_SIZE, config);
    if (!result || !Array.isArray(result.items) || !Number.isFinite(result.totalItems)) {
      throw new Error('ASEKO API returned an invalid paired-units response.');
    }
    for (const unit of result.items) {
      if (!unit || typeof unit.serialNumber !== 'string' || typeof unit.online !== 'boolean') {
        throw new Error('ASEKO API returned an invalid paired-unit record.');
      }
      units.push(unit);
    }
    if (result.items.length < PAGE_SIZE) {
      return units;
    }
  }
  throw new Error('ASEKO API pagination exceeded the safety limit.');
}

export async function getPairedUnit(serialNumber, config) {
  if (typeof serialNumber !== 'string' || serialNumber.length === 0) {
    throw new Error('ASEKO unit serial number is missing.');
  }
  const result = await request('/paired-units/' + encodeURIComponent(serialNumber), config);
  if (!result || result.serialNumber !== serialNumber || typeof result.online !== 'boolean') {
    throw new Error('ASEKO API returned an invalid unit detail response.');
  }
  return result;
}
