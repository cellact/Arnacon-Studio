import {
  ACTIVE_KINDS,
  ADDRESSING,
  FORBIDDEN_SPEC_KEYS,
  KIND,
  RUNTIME_MODES,
  SPEC_VERSION,
  THEME_PRESETS,
} from './constants.mjs';
import { COLOR_KEYS, isHexColor } from './theme.mjs';
import { GAP_PACKS, PACK_CATALOG, PACK_IDS, isPlainObject } from './packs.mjs';

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

function validateCommunication(errors, comm) {
  if (!isPlainObject(comm)) {
    errors.push(err('capabilities.communication', 'must be an object'));
    return;
  }
  for (const key of extraKeys(comm, ['sessions', 'messaging', 'calls'])) {
    errors.push(err(`capabilities.communication.${key}`, 'unknown key'));
  }

  if (!isPlainObject(comm.sessions)) {
    errors.push(err('capabilities.communication.sessions', 'is required'));
  } else {
    for (const key of extraKeys(comm.sessions, ['direct', 'groups', 'rename', 'delete'])) {
      errors.push(err(`capabilities.communication.sessions.${key}`, 'unknown key'));
    }
    checkBool(errors, 'capabilities.communication.sessions.direct', comm.sessions.direct, true);
    if (comm.sessions.direct !== true) {
      errors.push(err('capabilities.communication.sessions.direct', 'must be true'));
    }
    checkBool(errors, 'capabilities.communication.sessions.groups', comm.sessions.groups, false);
    checkBool(errors, 'capabilities.communication.sessions.rename', comm.sessions.rename, false);
    checkBool(errors, 'capabilities.communication.sessions.delete', comm.sessions.delete, false);
  }

  if (!isPlainObject(comm.messaging)) {
    errors.push(err('capabilities.communication.messaging', 'is required'));
  } else {
    for (const key of extraKeys(comm.messaging, [
      'text', 'files', 'replies', 'edits', 'forwards', 'delete',
      'reactions', 'typing', 'readReceipts', 'block', 'reachability',
    ])) {
      errors.push(err(`capabilities.communication.messaging.${key}`, 'unknown key'));
    }
    if (comm.messaging.text !== true) {
      errors.push(err('capabilities.communication.messaging.text', 'must be true'));
    }
    for (const flag of ['files', 'replies', 'edits', 'forwards', 'delete', 'reactions', 'typing', 'readReceipts', 'block', 'reachability']) {
      checkBool(errors, `capabilities.communication.messaging.${flag}`, comm.messaging[flag], false);
    }
  }

  if (comm.calls !== undefined) {
    if (!isPlainObject(comm.calls)) {
      errors.push(err('capabilities.communication.calls', 'must be an object'));
    } else {
      for (const key of extraKeys(comm.calls, [
        'voice', 'video', 'mute', 'hold', 'dtmf', 'transfer', 'switchCamera', 'audioDevice', 'dialer',
      ])) {
        errors.push(err(`capabilities.communication.calls.${key}`, 'unknown key'));
      }
      for (const flag of ['voice', 'video', 'mute', 'hold', 'dtmf', 'transfer', 'switchCamera', 'audioDevice', 'dialer']) {
        checkBool(errors, `capabilities.communication.calls.${flag}`, comm.calls[flag], false);
      }
    }
  }
}

function validateDevice(errors, device) {
  if (!isPlainObject(device)) {
    errors.push(err('capabilities.device', 'must be an object'));
    return;
  }
  for (const key of extraKeys(device, ['camera', 'imagePicker', 'contactPicker', 'qr', 'downloadFile'])) {
    errors.push(err(`capabilities.device.${key}`, 'unknown key'));
  }
  for (const flag of ['camera', 'imagePicker', 'contactPicker', 'qr', 'downloadFile']) {
    checkBool(errors, `capabilities.device.${flag}`, device[flag], false);
  }
}

function validateIdentityPack(errors, pack) {
  if (!isPlainObject(pack)) {
    errors.push(err('capabilities.identity', 'must be an object'));
    return;
  }
  for (const key of extraKeys(pack, ['switcher', 'pairing', 'qr'])) {
    errors.push(err(`capabilities.identity.${key}`, 'unknown key'));
  }
  for (const flag of ['switcher', 'pairing', 'qr']) {
    checkBool(errors, `capabilities.identity.${flag}`, pack[flag], false);
  }
}

/**
 * Validate a merged v2 intent spec. Unknown keys and platform-owned fields fail.
 * @returns {{ ok: boolean, errors: { path: string, message: string }[] }}
 */
export function validateSpec(spec) {
  const errors = [];
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    return { ok: false, errors: [err('', 'spec must be an object')] };
  }

  for (const key of extraKeys(spec, [
    'version', 'kind', 'app', 'runtime', 'identity', 'capabilities', 'theme', 'warnings',
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
    errors.push(err('kind', `must be "${KIND}"`));
  }

  if (spec.app !== undefined) {
    if (!isPlainObject(spec.app)) {
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

  if (!isPlainObject(spec.runtime)) {
    errors.push(err('runtime', 'is required'));
  } else {
    for (const key of extraKeys(spec.runtime, ['mode'])) {
      errors.push(err(`runtime.${key}`, 'unknown key'));
    }
    if (!RUNTIME_MODES.includes(spec.runtime.mode)) {
      errors.push(err('runtime.mode', `must be one of ${RUNTIME_MODES.join(', ')}`));
    }
  }

  if (!isPlainObject(spec.identity)) {
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

  if (spec.capabilities !== undefined) {
    if (!isPlainObject(spec.capabilities)) {
      errors.push(err('capabilities', 'must be an object'));
    } else {
      for (const key of extraKeys(spec.capabilities, PACK_IDS)) {
        errors.push(err(`capabilities.${key}`, 'unknown pack'));
      }
      if (spec.capabilities.communication !== undefined) {
        validateCommunication(errors, spec.capabilities.communication);
      }
      if (spec.capabilities.device !== undefined) {
        validateDevice(errors, spec.capabilities.device);
      }
      if (spec.capabilities.identity !== undefined) {
        validateIdentityPack(errors, spec.capabilities.identity);
      }
      for (const pack of GAP_PACKS) {
        if (spec.capabilities[pack] !== undefined) {
          errors.push(err(
            `capabilities.${pack}`,
            PACK_CATALOG[pack].message,
          ));
        }
      }
    }
  }

  if (spec.theme !== undefined) {
    if (!isPlainObject(spec.theme)) {
      errors.push(err('theme', 'must be an object'));
    } else {
      for (const key of extraKeys(spec.theme, ['preset', 'colors'])) {
        errors.push(err(`theme.${key}`, 'unknown key'));
      }
      if (spec.theme.preset !== undefined && !THEME_PRESETS.includes(spec.theme.preset)) {
        errors.push(err('theme.preset', `must be one of ${THEME_PRESETS.join(', ')}`));
      }
      if (spec.theme.colors !== undefined) {
        if (!isPlainObject(spec.theme.colors)) {
          errors.push(err('theme.colors', 'must be an object'));
        } else {
          for (const key of extraKeys(spec.theme.colors, COLOR_KEYS)) {
            errors.push(err(`theme.colors.${key}`, 'unknown color token'));
          }
          for (const key of COLOR_KEYS) {
            if (spec.theme.colors[key] !== undefined && !isHexColor(spec.theme.colors[key])) {
              errors.push(err(`theme.colors.${key}`, 'must be a #RRGGBB hex color'));
            }
          }
        }
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
