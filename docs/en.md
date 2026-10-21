# ASEKO Pool integration

This external integration reads pool-unit status from the ASEKO Public ACS API. It is read-only: it does not turn the filtration pump on or off and does not send commands to any ASEKO equipment.

## Setup

1. Create an API key from your ASEKO account settings at https://account.aseko.cloud/profile/settings/api-keys.
2. Accept the current ASEKO terms of service.
3. Install ASEKO Pool in Gladys Assistant 5.1.0 or later.
4. Enter the key in the integration's ASEKO API key field. The field is stored as a Gladys secret.
5. Set the refresh interval (60–3600 seconds; default 300), save, and scan for units.

The integration discovers the paired units in your ASEKO account. For each unit, it adds only telemetry fields the API says are available. The pump/filtration state, temperatures, pH, redox, pressure, water flow, water level, operating mode and status messages can be exposed when supported by that unit. Missing or null measurements are not published.

## Troubleshooting

- 401 Unauthorized: verify the API key and that it has not expired or been deleted.
- 403 Forbidden: accept ASEKO's current terms of service; API access may also depend on your account plan.
- 429 Too Many Requests: increase the refresh interval and try again later.
- No device or measurements: confirm the unit is paired in ASEKO Cloud and has reported data to ASEKO.

The integration makes only HTTPS GET requests to https://api.aseko.cloud/api/v1. It never logs the API key.

API documentation: https://api.aseko.cloud/api/v1/docs.
