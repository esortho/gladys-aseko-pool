import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { buildDiscoveredDevices, createPoller } from './src/devices/index.js';

const gladys = new GladysIntegration();
let config = normalizeConfig();
const pollDevice = createPoller();

async function discoverAndPublish() {
  if (!config.api_key) throw new Error('Configure the ASEKO API key before scanning.');
  const devices = await buildDiscoveredDevices(gladys, config);
  await gladys.publishDiscoveredDevices(devices);
  return devices.length;
}

async function initialize() {
  if (!config.api_key) {
    await gladys.setConnectionStatus(false, {
      en: 'Add your ASEKO API key in the integration configuration.',
      fr: "Ajoutez votre clé API ASEKO dans la configuration de l'intégration.",
    });
    return;
  }
  await discoverAndPublish();
  await gladys.setConnectionStatus(true);
}

gladys.onScanRequest(async () => {
  logger.info('Scanning ASEKO account for paired pool units.');
  try {
    const count = await discoverAndPublish();
    logger.info('ASEKO scan complete; discovered ' + count + ' unit(s).');
  } catch (error) {
    logger.error('ASEKO scan failed: ' + error.message);
    throw error;
  }
});

gladys.onPoll(async (device) => {
  try {
    await pollDevice(gladys, device, config);
  } catch (error) {
    logger.error('ASEKO status poll failed: ' + error.message);
    throw error;
  }
});

gladys.onConfigUpdated(async (newConfig) => {
  config = normalizeConfig(newConfig);
  try {
    await initialize();
  } catch (error) {
    logger.error('ASEKO configuration check failed: ' + error.message);
    await gladys
      .setConnectionStatus(false, {
        en: 'ASEKO could not be reached; check the API key and integration logs.',
        fr: "ASEKO n'est pas joignable ; vérifiez la clé API et les journaux de l'intégration.",
      })
      .catch(() => {});
  }
});

gladys.on('connected', async () => {
  try {
    config = normalizeConfig(await gladys.getConfig());
    await initialize();
  } catch (error) {
    logger.error('ASEKO initialization failed: ' + error.message);
    await gladys
      .setConnectionStatus(false, {
        en: 'ASEKO could not be reached; check the API key and integration logs.',
        fr: "ASEKO n'est pas joignable ; vérifiez la clé API et les journaux de l'intégration.",
      })
      .catch(() => {});
  }
});

gladys.handleShutdown((signal) => {
  logger.info('Received ' + signal + '; shutting down cleanly.');
});

logger.info('Starting the read-only ASEKO pool integration.');
gladys.connect().catch((error) => {
  logger.error('Initial Gladys connection failed: ' + error.message);
  process.exit(1);
});
