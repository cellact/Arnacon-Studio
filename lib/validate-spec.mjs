import {
  ACTIVE_KINDS,
  ADDRESSING,
  FORBIDDEN_SPEC_KEYS,
  KIND,
  RUNTIME_MODES,
  SPEC_VERSION,
  THEME_PRESETS,
} from './constants.mjs';

function err(path, message) {
  return { path, message };
}

function checkBool(errors, path, value, required) {
  if (value === undefined) {
    if (required) errors.push(err(path, 'is required'));
    return;
  }
  if (typeof value !== 'boolean') errors.push(err(path, 'must be a boolean'));
}

function uniqueEnumArray(errors, path, value, allowed, { required, minItems = 0 } = {}) {
  if (value === undefined) {
    if (required) errors.push(err(path, 'is required'));
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(err(path, 'must be an array'));
    return;
  }
  if (value.length < minItems) errors.push(err(path, `must have at least ${minItems} item(s)`));
  const seen = new Set();
  for (const item of value) {
    if (!allowed.includes(item)) errors.push(err(path, `contains unknown value "${item}"`));
    if (seen.has(item)) errors.push(err(path, `duplicate value "${item}"`));
    seen.add(item);
  }
}

function extraKeys(obj, allowed) {
  return Object.keys(obj || {}).filter((key) => !allowed.includes(key));
}

/**
 * Validate a merged intent spec. Unknown keys and platform-owned fields fail.
 * @returns {{ ok: boolean, errors: { path: string, message: string }[] }}
 */
export function validateSpec(spec) {
  const errors = [];
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    return { ok: false, errors: [err('', 'spec must be an object')] };
  }

  for (const key of extraKeys(spec, [
    'version', 'kind', 'app', 'runtime', 'identity', 'sessions',
    'messaging', 'calls', 'device', 'theme', 'warnings',
  ])) {
    const hint = FORBIDDEN_SPEC_KEYS.includes(key)
      ? 'this field is platform-owned and must not appear in the spec'
      : 'unknown key';
    errors.push(err(key, hint));
  }

  if (spec.version !== SPEC_VERSION) {
    errors.push(err('version', `must be ${SPEC_VERSION}`));
  }
  if (spec.kind !== KIND) {
    errors.push(err('kind', `must be "${KIND}" (refuse any other app kind)`));
  }

  if (spec.app !== undefined) {
    if (typeof spec.app !== 'object' || spec.app === null || Array.isArray(spec.app)) {
      errors.push(err('app', 'must be an object'));
    } else {
      for (const key of extraKeys(spec.app, ['name', 'summary'])) {
        errors.push(err(`app.${key}`, 'unknown key'));
      }
      if (spec.app.name !== undefined && (typeof spec.app.name !== 'string' || !spec.app.name.trim())) {
        errors.push(err('app.name', 'must be a non-empty string'));
      }
      if (spec.app.summary !== undefined && typeof spec.app.summary !== 'string') {
        errors.push(err('app.summary', 'must be a string'));
      }
    }
  }

  if (!spec.runtime || typeof spec.runtime !== 'object') {
    errors.push(err('runtime', 'is required'));
  } else {
    for (const key of extraKeys(spec.runtime, ['mode'])) {
      errors.push(err(`runtime.${key}`, 'unknown key'));
    }
    if (!RUNTIME_MODES.includes(spec.runtime.mode)) {
      errors.push(err('runtime.mode', `must be one of ${RUNTIME_MODES.join(', ')}`));
    }
  }

  if (!spec.identity || typeof spec.identity !== 'object') {
    errors.push(err('identity', 'is required'));
  } else {
    for (const key of extraKeys(spec.identity, ['source', 'activeKinds', 'addressing'])) {
      errors.push(err(`identity.${key}`, 'unknown key'));
    }
    if (spec.identity.source !== 'installed-product') {
      errors.push(err('identity.source', 'must be "installed-product"'));
    }
    uniqueEnumArray(errors, 'identity.activeKinds', spec.identity.activeKinds, ACTIVE_KINDS, {
      required: true,
      minItems: 1,
    });
    uniqueEnumArray(errors, 'identity.addressing', spec.identity.addressing, ADDRESSING, {
      required: false,
    });
  }

  if (!spec.sessions || typeof spec.sessions !== 'object') {
    errors.push(err('sessions', 'is required'));
  } else {
    for (const key of extraKeys(spec.sessions, ['direct', 'groups', 'rename', 'delete'])) {
      errors.push(err(`sessions.${key}`, 'unknown key'));
    }
    checkBool(errors, 'sessions.direct', spec.sessions.direct, true);
    if (spec.sessions.direct !== true) {
      errors.push(err('sessions.direct', 'must be true for communication-client v1'));
    }
    checkBool(errors, 'sessions.groups', spec.sessions.groups, false);
    checkBool(errors, 'sessions.rename', spec.sessions.rename, false);
    checkBool(errors, 'sessions.delete', spec.sessions.delete, false);
  }

  if (!spec.messaging || typeof spec.messaging !== 'object') {
    errors.push(err('messaging', 'is required'));
  } else {
    for (const key of extraKeys(spec.messaging, [
      'text', 'files', 'replies', 'edits', 'forwards', 'delete',
      'reactions', 'typing', 'readReceipts', 'block', 'reachability',
    ])) {
      errors.push(err(`messaging.${key}`, 'unknown key'));
    }
    if (spec.messaging.text !== true) {
      errors.push(err('messaging.text', 'must be true'));
    }
    for (const flag of ['files', 'replies', 'edits', 'forwards', 'delete', 'reactions', 'typing', 'readReceipts', 'block', 'reachability']) {
      checkBool(errors, `messaging.${flag}`, spec.messaging[flag], false);
    }
  }

  if (spec.calls !== undefined) {
    if (typeof spec.calls !== 'object' || spec.calls === null) {
      errors.push(err('calls', 'must be an object'));
    } else {
      for (const key of extraKeys(spec.calls, [
        'voice', 'video', 'mute', 'hold', 'dtmf', 'transfer', 'switchCamera', 'audioDevice', 'dialer',
      ])) {
        errors.push(err(`calls.${key}`, 'unknown key'));
      }
      for (const flag of ['voice', 'video', 'mute', 'hold', 'dtmf', 'transfer', 'switchCamera', 'audioDevice', 'dialer']) {
        checkBool(errors, `calls.${flag}`, spec.calls[flag], false);
      }
    }
  }

  if (spec.device !== undefined) {
    if (typeof spec.device !== 'object' || spec.device === null) {
      errors.push(err('device', 'must be an object'));
    } else {
      for (const key of extraKeys(spec.device, ['camera', 'imagePicker', 'contactPicker', 'qr', 'downloadFile'])) {
        errors.push(err(`device.${key}`, 'unknown key'));
      }
      for (const flag of ['camera', 'imagePicker', 'contactPicker', 'qr', 'downloadFile']) {
        checkBool(errors, `device.${flag}`, spec.device[flag], false);
      }
    }
  }

  if (spec.theme !== undefined) {
    if (typeof spec.theme !== 'object' || spec.theme === null) {
      errors.push(err('theme', 'must be an object'));
    } else {
      for (const key of extraKeys(spec.theme, ['preset'])) {
        errors.push(err(`theme.${key}`, 'unknown key'));
      }
      if (spec.theme.preset !== undefined && !THEME_PRESETS.includes(spec.theme.preset)) {
        errors.push(err('theme.preset', `must be one of ${THEME_PRESETS.join(', ')}`));
      }
    }
  }

  if (spec.warnings !== undefined) {
    if (!Array.isArray(spec.warnings) || spec.warnings.some((w) => typeof w !== 'string')) {
      errors.push(err('warnings', 'must be an array of strings'));
    }
  }

  return { ok: errors.length === 0, errors };
}
