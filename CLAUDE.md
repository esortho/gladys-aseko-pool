# Development notes

- This repository is a Gladys Assistant external integration for ASEKO pool telemetry.
- Keep all provider operations read-only: use only ASEKO GET endpoints; never add pump or equipment commands.
- Use the official @gladysassistant/integration-sdk and the manifest file gladys-assistant-integration.json.
- Store the ASEKO API key only in Gladys' manifest-backed secret configuration; never commit, log, or expose it.
- Base field mappings on the ASEKO OpenAPI schema. Treat absent and null status values as unavailable.
- Run npm test, npm run lint, and npm run format:check after changes.
- Release images are built by the existing GitHub Actions workflow; do not publish without an explicit release decision.
