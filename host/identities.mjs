/**
 * Installed-product list and switching for the computer tab.
 * The phone answers get-identity-list / set-active-identity over the pairing
 * relay, matching ArnaconWeb's nav rail. The skin never sends raw relay actions.
 */

const LIST_TIMEOUT_MS = 8000;
const SWITCH_TIMEOUT_MS = 12000;

function emitOn(controller, action, body) {
    if (typeof controller.receiveData === 'function') {
        controller.receiveData(JSON.stringify({ action, body }));
        return;
    }
    if (typeof controller._emit === 'function') {
        controller._emit(action, body);
    }
}

function send(controller, action, body) {
    const payload = { action, body: { localId: controller.localId, ...body } };
    if (typeof controller._send === 'function') {
        controller._send(payload);
        return;
    }
    if (typeof controller._pairingSend === 'function') {
        controller._pairingSend(payload);
    }
}

function hasIdentityPayload(body) {
    return !!body && (body.navMenu != null || body.identityList != null);
}

/**
 * Native answers with either a prebuilt navMenu or raw identityList rows
 * ([id, label, localId]). Section headers are chrome, not identities.
 */
function normalize(body) {
    const active = body.activeLocalId || '';
    if (Array.isArray(body.navMenu) && body.navMenu.length) {
        return body.navMenu
            .filter((item) => item && !item.section)
            .map((item) => ({
                id: item.id,
                label: item.label || item.localId || 'Identity',
                localId: item.localId || '',
                kind: item.kind || 'arnacon',
                selected: item.selected != null ? !!item.selected : item.localId === active,
            }));
    }
    if (Array.isArray(body.identityList)) {
        return body.identityList.map((row) => ({
            id: Number(row[0]),
            label: row[1] || row[2] || 'Identity',
            localId: row[2] || '',
            kind: 'arnacon',
            selected: row[2] === active,
        }));
    }
    return [];
}

/**
 * @param {object} controller
 * @returns {object} controller
 */
export function installIdentities(controller) {
    if (!controller) return controller;

    let latest = { identities: [], activeLocalId: controller.localId || '' };
    const waiting = [];
    const switching = [];

    function resolvePayload(body) {
        const activeLocalId = body.activeLocalId || controller.localId || '';
        const identityKind = body.identityKind || '';
        const switched = activeLocalId && activeLocalId !== controller.localId;
        latest = { identities: normalize(body), activeLocalId, identityKind };

        while (waiting.length) {
            const pending = waiting.shift();
            clearTimeout(pending.timer);
            pending.resolve(latest);
        }
        for (let i = switching.length - 1; i >= 0; i--) {
            if (switching[i].localId && switching[i].localId !== activeLocalId) continue;
            const pending = switching.splice(i, 1)[0];
            clearTimeout(pending.timer);
            pending.resolve(latest);
        }

        emitOn(controller, 'identity-list', latest);
        if (switched) {
            // Native answers a switch with a fresh list, never identity-change.
            // Synthesize it so skins have one signal for "the product changed".
            controller.localId = activeLocalId;
            emitOn(controller, 'identity-change', {
                localId: activeLocalId,
                identityKind: identityKind || 'arnacon',
            });
        }
        return latest;
    }

    controller.on('data-retrieved', (body) => {
        if (hasIdentityPayload(body)) resolvePayload(body);
    });

    controller.listIdentities = function listIdentities() {
        send(controller, 'get-identity-list', {});
        return new Promise((resolve, reject) => {
            const pending = { resolve };
            pending.timer = setTimeout(() => {
                const index = waiting.indexOf(pending);
                if (index >= 0) waiting.splice(index, 1);
                reject(new Error('The phone did not return the identity list.'));
            }, LIST_TIMEOUT_MS);
            waiting.push(pending);
        });
    };

    controller.switchIdentity = function switchIdentity(identity) {
        if (!identity) throw new Error('switchIdentity needs an identity from listIdentities().');
        send(controller, 'set-active-identity', {
            identityId: identity.id,
            id: identity.id,
            localId: identity.localId,
            kind: identity.kind,
        });
        return new Promise((resolve, reject) => {
            const pending = { resolve, localId: identity.localId || '' };
            pending.timer = setTimeout(() => {
                const index = switching.indexOf(pending);
                if (index >= 0) switching.splice(index, 1);
                reject(new Error('The phone did not confirm the identity switch.'));
            }, SWITCH_TIMEOUT_MS);
            switching.push(pending);
        });
    };

    controller.getIdentities = function getIdentities() {
        return { ...latest, identities: [...latest.identities] };
    };

    // The phone only knows the browser is listening once the room is live.
    controller.on('pairing-ready', () => {
        send(controller, 'get-identity-list', {});
    });

    return controller;
}
