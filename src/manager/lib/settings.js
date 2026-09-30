import { t } from '../../i18n/runtime.js';

export const DEFAULT_SETTINGS = Object.freeze({
  durationBounds: Object.freeze([5, 20, 60]),
  removeDelayMin: 1,
  removeDelayMax: 2,
  testModeCount: 3,
  apiKey: '',
});

// The delay floor keeps removal at a pace a person could click at.
export const SETTINGS_LIMITS = Object.freeze({
  delayMin: 1,
  delayMax: 30,
  boundsMax: 8,
  boundMinutesMax: 1440,
  testModeMax: 50,
});

const API_KEY_PATTERN = /^[\w-]{20,100}$/;

const isNumberInRange = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

// Minutes, strictly increasing, without duplicates.
const cleanBounds = (values) => [...new Set(values)].sort((a, b) => a - b);

// Parses "5, 20, 60" into [5, 20, 60].
export const parseBounds = (text) => {
  const parts = String(text ?? '').split(/[\s,]+/).filter(Boolean);

  if (parts.length === 0) {
    return { error: t('settings.error-bounds-empty') };
  }

  if (parts.length > SETTINGS_LIMITS.boundsMax) {
    return { error: t('settings.error-bounds-count', { max: SETTINGS_LIMITS.boundsMax }) };
  }

  const values = parts.map(Number);

  if (values.some((value) => !Number.isInteger(value) || !isNumberInRange(value, 1, SETTINGS_LIMITS.boundMinutesMax))) {
    return { error: t('settings.error-bounds-range', { max: SETTINGS_LIMITS.boundMinutesMax }) };
  }

  return { value: cleanBounds(values) };
};

export const formatBounds = (bounds) => bounds.join(', ');

// Fills in defaults for anything missing or invalid in stored settings.
export const normalizeSettings = (stored) => {
  const input = stored && typeof stored === 'object' ? stored : {};
  const bounds = Array.isArray(input.durationBounds) ? parseBounds(input.durationBounds.join(',')) : {};
  const delayMin = isNumberInRange(input.removeDelayMin, SETTINGS_LIMITS.delayMin, SETTINGS_LIMITS.delayMax)
    ? input.removeDelayMin
    : DEFAULT_SETTINGS.removeDelayMin;
  const delayMax = isNumberInRange(input.removeDelayMax, delayMin, SETTINGS_LIMITS.delayMax)
    ? input.removeDelayMax
    : Math.max(delayMin, DEFAULT_SETTINGS.removeDelayMax);

  return {
    durationBounds: bounds.value ?? [...DEFAULT_SETTINGS.durationBounds],
    removeDelayMin: delayMin,
    removeDelayMax: delayMax,
    testModeCount: Number.isInteger(input.testModeCount) && isNumberInRange(input.testModeCount, 1, SETTINGS_LIMITS.testModeMax)
      ? input.testModeCount
      : DEFAULT_SETTINGS.testModeCount,
    apiKey: typeof input.apiKey === 'string' && API_KEY_PATTERN.test(input.apiKey) ? input.apiKey : '',
  };
};

// Validates the settings form. Returns the settings to save, or an error
// message per field.
export const validateSettingsForm = ({ boundsText, delayMin, delayMax, testModeCount, apiKey }) => {
  const errors = {};
  const bounds = parseBounds(boundsText);
  const min = Number(delayMin);
  const max = Number(delayMax);
  const count = Number(testModeCount);
  const key = String(apiKey ?? '').trim();

  if (bounds.error) {
    errors.bounds = bounds.error;
  }

  if (!isNumberInRange(min, SETTINGS_LIMITS.delayMin, SETTINGS_LIMITS.delayMax)) {
    errors.delayMin = t('settings.error-delay-min', { min: SETTINGS_LIMITS.delayMin, max: SETTINGS_LIMITS.delayMax });
  }

  if (!isNumberInRange(max, SETTINGS_LIMITS.delayMin, SETTINGS_LIMITS.delayMax)) {
    errors.delayMax = t('settings.error-delay-max', { min: SETTINGS_LIMITS.delayMin, max: SETTINGS_LIMITS.delayMax });
  } else if (!errors.delayMin && max < min) {
    errors.delayMax = t('settings.error-delay-order');
  }

  if (!Number.isInteger(count) || !isNumberInRange(count, 1, SETTINGS_LIMITS.testModeMax)) {
    errors.testModeCount = t('settings.error-test-count', { max: SETTINGS_LIMITS.testModeMax });
  }

  if (key && !API_KEY_PATTERN.test(key)) {
    errors.apiKey = t('settings.error-api-key');
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    settings: {
      durationBounds: bounds.value,
      removeDelayMin: min,
      removeDelayMax: max,
      testModeCount: count,
      apiKey: key,
    },
  };
};
