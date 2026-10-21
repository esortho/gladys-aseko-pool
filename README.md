# Gladys ASEKO Pool

A read-only external integration for Gladys Assistant that imports pool-unit status and measurements from ASEKO's Public ACS API.

**This integration never sends commands.** The filtration pump and every other reported state are read-only; this project cannot turn the pump on or off.

## What it reads

For each ASEKO unit paired with your account, Gladys discovers a device and exposes the values returned by that unit's API, when available. This includes filtration-pump state, water/air/solar temperature, pH, redox, filter pressure and flow, water level, operating mode, online status, and ASEKO status messages. Unsupported or temporarily empty values are omitted rather than invented.

## Setup in Gladys

1. Create an API key in your ASEKO account settings: https://account.aseko.cloud/profile/settings/api-keys
2. Accept ASEKO's current terms of service in your account.
3. Install ASEKO Pool in Gladys (version 5.1.0 or later).
4. Paste the key into the integration's ASEKO API key field. Gladys stores this as a secret.
5. Choose a refresh interval from 60 to 3600 seconds (default: 300 seconds), save, and scan for devices.

ASEKO API documentation: https://api.aseko.cloud/api/v1/docs

## Development

Requirements: Node.js 24 (22 or later) and Docker for building the integration image.

- npm ci
- npm test
- npm run lint
- npm run format:check
- docker build -t gladys-aseko-pool:local .

The test suite uses mocked API responses; it does not need an ASEKO API key and never contacts real pool equipment.

## Privacy and errors

The API key is configured through Gladys' secret configuration field and is never logged by this integration. Requests are read-only HTTPS GETs to ASEKO. HTTP 401 usually means the key is invalid or expired; HTTP 403 may mean the terms are not accepted or the account plan does not allow API access; HTTP 429 means ASEKO's rate limit was reached. A failed poll is retried at the next scheduled interval.

## License

Apache-2.0.
