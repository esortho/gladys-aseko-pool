export const DEFAULT_CONFIG = {
  api_key: '',
  poll_frequency: 300,
};

export function normalizeConfig(raw = {}) {
  const requestedFrequency = Number(raw.poll_frequency ?? DEFAULT_CONFIG.poll_frequency);
  const pollFrequency =
    Number.isFinite(requestedFrequency) && requestedFrequency >= 60 && requestedFrequency <= 3600
      ? requestedFrequency
      : DEFAULT_CONFIG.poll_frequency;
  return {
    api_key: typeof raw.api_key === 'string' ? raw.api_key.trim() : '',
    poll_frequency: pollFrequency,
  };
}
