/**
 * Fetch the harness origin. Confirms the page and runtime modules load.
 * Does not execute JS in a browser.
 */

import { HOST_RUNTIME_FILES } from './conformance.mjs';
import { createHostServer } from '../host/serve.mjs';

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text, type: res.headers.get('content-type') || '' };
}

function failList() {
  const errors = [];
  return {
    errors,
    fail(file, message) {
      errors.push({ file, message });
    },
  };
}

export async function checkOrigin(origin) {
  const { errors, fail } = failList();
  const base = String(origin).replace(/\/$/, '');

  const home = await get(`${base}/`);
  if (!home.ok) {
    fail('/', `origin did not load (${home.status})`);
    return { ok: false, errors };
  }
  if (!/installArnaconWebApp|__arnaconRuntimePromise|bootHost|runtime\.mjs/.test(home.text)) {
    fail('/', 'loaded HTML does not install the Arnacon runtime');
  }
  if (!/controller/.test(home.text) && !/bootHost/.test(home.text)) {
    fail('/', 'loaded HTML never mentions controller or bootHost');
  }

  for (const rel of HOST_RUNTIME_FILES) {
    const got = await get(`${base}/${rel}`);
    if (!got.ok) {
      fail(rel, `runtime module did not load (${got.status})`);
      continue;
    }
    if (!/javascript/.test(got.type) && !/ecmascript/.test(got.type)) {
      fail(rel, `runtime module Content-Type is ${got.type || 'missing'}`);
    }
  }

  const runtime = await get(`${base}/host/runtime.mjs`);
  if (runtime.ok && !/installArnaconWebApp/.test(runtime.text)) {
    fail('host/runtime.mjs', 'module must export installArnaconWebApp');
  }

  return { ok: errors.length === 0, errors };
}

export async function checkLocalHarness(root) {
  const server = createHostServer(root);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  try {
    return await checkOrigin(origin);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}
