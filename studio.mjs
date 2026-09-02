import { DEFAULT_SPEC } from './lib/defaults.mjs';
import { interpret } from './lib/interpret.mjs';
import { compile } from './lib/compile.mjs';
import { buildFromSpec } from './lib/pipeline.mjs';
import { zipFiles } from './lib/zip.mjs';
import { createMockController } from './preview/mock-controller.mjs';

const SCREEN_LABELS = {
  MAIN: 'Chats',
  CHAT: 'Conversation',
  NEW_CHAT: 'New chat',
  CREATE_GROUP: 'New group',
  CALL: 'In a call',
  RING: 'Ringing',
  INCOMING: 'Incoming call',
  DIALER: 'Dialer',
  PAIRING: 'Pair phone',
};

const KIND_LABELS = {
  arnacon: 'Arnacon',
  whatsapp: 'WhatsApp',
  email: 'Email',
  temp: 'Private name',
};

const promptEl = document.getElementById('prompt');
const statusEl = document.getElementById('status');
const messagesEl = document.getElementById('messages');
const specView = document.getElementById('specView');
const screenOut = document.getElementById('screenOut');
const methodOut = document.getElementById('methodOut');
const eventOut = document.getElementById('eventOut');
const specWarn = document.getElementById('specWarn');
const lintStatus = document.getElementById('lintStatus');
const warnBox = document.getElementById('warnBox');
const preview = document.getElementById('preview');
const exampleChips = document.getElementById('exampleChips');
const screenSelect = document.getElementById('screenSelect');
const kindSelect = document.getElementById('kindSelect');
const screenChips = document.getElementById('screenChips');
const downloadBtn = document.getElementById('downloadBtn');

window.controller = createMockController();
window.__studioPreview = {
  localId: 'studio-preview',
  identityKind: 'arnacon',
  sessionId: '101',
  remoteId: 'alex',
  sessionName: 'Alex',
};

let examples = [];
let lastSpec = DEFAULT_SPEC;
let lastFiles = null;
let lastCompiled = null;
let currentScreen = 'MAIN';
let previewTimer = 0;
const objectUrls = [];

function revokeUrls() {
  while (objectUrls.length) URL.revokeObjectURL(objectUrls.pop());
}

function cssUrl(files) {
  const url = URL.createObjectURL(new Blob([files['app.css']], { type: 'text/css' }));
  objectUrls.push(url);
  return url;
}

function srcdocFor(filename, files) {
  const css = cssUrl(files);
  let html = files[filename];
  if (!html) {
    return '<p style="font-family:sans-serif;padding:24px">This screen is not in the app.</p>';
  }
  html = html.replace('href="app.css"', `href="${css}"`);
  if (files['identity.js']) {
    html = html.replace('<script src="identity.js"></script>', `<script>${files['identity.js']}<\/script>`);
  }
  return html;
}

function fileForScreen(screen) {
  if (screen === 'CHAT') return 'chat.html';
  if (screen === 'NEW_CHAT') return 'newchat.html';
  if (screen === 'CREATE_GROUP') return 'creategroup.html';
  if (screen === 'RING') return 'ringing.html';
  if (screen === 'INCOMING') return 'incomingcall.html';
  if (screen === 'PAIRING') return 'pairing.html';
  if (screen === 'DIALER') return 'dialer.html';
  if (screen === 'CALL') return 'voicecall.html';
  return 'mainscreen.html';
}

function showPreview(files, screen = 'MAIN') {
  revokeUrls();
  lastFiles = files;
  currentScreen = screen;
  window.__studioPreview = { ...window.__studioPreview, screen };
  preview.srcdoc = srcdocFor(fileForScreen(screen), files);
  screenSelect.value = screen;
  for (const chip of screenChips.querySelectorAll('.chip')) {
    chip.classList.toggle('active', chip.dataset.screen === screen);
  }
}

window.addEventListener('message', (event) => {
  if (!lastFiles || !event.data || event.data.action !== 'arnacon-navigate') return;
  const extra = event.data.extra || {};
  window.__studioPreview = { ...window.__studioPreview, ...extra };
  showPreview(lastFiles, event.data.screen || 'MAIN');
});

function fillSelect(el, values, current, labels) {
  el.innerHTML = values.map((value) => {
    const selected = value === current ? ' selected' : '';
    const label = (labels && labels[value]) || value;
    return `<option value="${value}"${selected}>${label}</option>`;
  }).join('');
}

function renderScreenChips(screens) {
  screenChips.innerHTML = '';
  for (const screen of screens) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip' + (screen === currentScreen ? ' active' : '');
    btn.dataset.screen = screen;
    btn.textContent = SCREEN_LABELS[screen] || screen;
    btn.addEventListener('click', () => {
      if (lastFiles) showPreview(lastFiles, screen);
    });
    screenChips.appendChild(btn);
  }
}

function showLiveSpec(spec) {
  lastSpec = spec;
  specView.value = JSON.stringify(spec, null, 2);
  const compiled = compile(spec);
  screenOut.innerHTML = compiled.screens
    .map((s) => `<span class="chip">${s}</span>`)
    .join('');
  methodOut.innerHTML = compiled.methods
    .filter((m) => m !== 'on' && m !== 'off')
    .map((m) => `<span class="chip">${m}</span>`)
    .join('');
  eventOut.innerHTML = compiled.events
    .map((e) => `<span class="chip">${e}</span>`)
    .join('');
  specWarn.innerHTML = (spec.warnings || [])
    .map((w) => `<div class="warn">${w}</div>`)
    .join('');
}

function interpretPrompt() {
  const spec = interpret(promptEl.value, examples);
  showLiveSpec(spec);
  return spec;
}

function buildFromCurrentSpec() {
  messagesEl.innerHTML = '';
  warnBox.innerHTML = '';
  const result = buildFromSpec(lastSpec);
  if (!result.validation.ok) {
    messagesEl.innerHTML = result.validation.errors
      .map((e) => `<div class="err">${e.message}</div>`)
      .join('');
    statusEl.textContent = 'That description could not be turned into an app.';
    statusEl.className = 'status bad';
    lintStatus.textContent = 'Spec rejected';
    lintStatus.className = 'status bad';
    return;
  }
  lastSpec = result.spec;
  lastCompiled = result.compiled;
  showLiveSpec(result.spec);
  currentScreen = 'MAIN';
  const kinds = result.spec.identity.activeKinds || ['arnacon'];
  if (!kinds.includes(window.__studioPreview.identityKind)) {
    window.__studioPreview.identityKind = kinds[0];
  }
  fillSelect(screenSelect, result.compiled.screens, currentScreen, SCREEN_LABELS);
  fillSelect(kindSelect, kinds, window.__studioPreview.identityKind, KIND_LABELS);
  renderScreenChips(result.compiled.screens);
  warnBox.innerHTML = (result.compiled.warnings || [])
    .map((w) => `<div class="warn">${w}</div>`)
    .join('');
  if (!result.lint.ok) {
    lintStatus.textContent = 'Lint failed';
    lintStatus.className = 'status bad';
    statusEl.textContent = 'The generated app failed a safety check.';
    statusEl.className = 'status bad';
    messagesEl.innerHTML += result.lint.errors
      .map((e) => `<div class="err">${e.message}</div>`)
      .join('');
    return;
  }
  lintStatus.textContent = `Lint passed · ${Object.keys(result.files).length} files`;
  lintStatus.className = 'status ok';
  statusEl.textContent = 'Preview is ready — tap through the phone on the right.';
  statusEl.className = 'status ok';
  downloadBtn.disabled = false;
  showPreview(result.files, 'MAIN');
}

function createFromPrompt() {
  interpretPrompt();
  const n = lastSpec.warnings?.length || 0;
  statusEl.textContent = n ? `Created with ${n} note${n === 1 ? '' : 's'}.` : 'Creating preview…';
  statusEl.className = 'status';
  buildFromCurrentSpec();
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    statusEl.textContent = 'Updating preview…';
    statusEl.className = 'status';
    buildFromCurrentSpec();
  }, 450);
}

async function loadExamples() {
  const names = [
    'examples/01-direct-chat.json',
    'examples/02-family-groups-video.json',
    'examples/03-email-support-inbox.json',
  ];
  examples = await Promise.all(names.map(async (name) => {
    const res = await fetch(name);
    if (!res.ok) throw new Error(`Could not load ${name}`);
    return res.json();
  }));
  exampleChips.innerHTML = '';
  for (const example of examples) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.type = 'button';
    btn.textContent = example.title;
    btn.addEventListener('click', () => {
      for (const chip of exampleChips.querySelectorAll('.chip')) chip.classList.remove('active');
      btn.classList.add('active');
      promptEl.value = example.prompt;
      createFromPrompt();
    });
    exampleChips.appendChild(btn);
  }
}

function applyEditedSpec() {
  let spec;
  try {
    spec = JSON.parse(specView.value);
  } catch (err) {
    messagesEl.innerHTML = `<div class="err">Spec JSON is invalid: ${err.message}</div>`;
    statusEl.textContent = 'Fix the spec JSON to apply it.';
    statusEl.className = 'status bad';
    return;
  }
  lastSpec = spec;
  showLiveSpec(spec);
  statusEl.textContent = 'Building from edited spec…';
  statusEl.className = 'status';
  buildFromCurrentSpec();
}

document.getElementById('createBtn').addEventListener('click', createFromPrompt);
document.getElementById('applySpecBtn').addEventListener('click', applyEditedSpec);

promptEl.addEventListener('input', () => {
  interpretPrompt();
  statusEl.textContent = 'Spec updated from prompt.';
  statusEl.className = 'status';
  schedulePreview();
});

promptEl.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    createFromPrompt();
  }
});

document.getElementById('cloneBtn').addEventListener('click', () => {
  promptEl.value = 'clone the web app';
  for (const chip of exampleChips.querySelectorAll('.chip')) chip.classList.remove('active');
  createFromPrompt();
});

screenSelect.addEventListener('change', () => {
  if (lastFiles) showPreview(lastFiles, screenSelect.value);
});

kindSelect.addEventListener('change', () => {
  window.__studioPreview.identityKind = kindSelect.value;
  if (lastFiles) showPreview(lastFiles, currentScreen);
});

downloadBtn.addEventListener('click', () => {
  if (!lastFiles || !lastCompiled) return;
  const bytes = zipFiles(lastFiles);
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (lastCompiled.spec.app?.name || 'arnacon-app').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.href = url;
  a.download = `${name || 'arnacon-app'}.zip`;
  a.click();
  URL.revokeObjectURL(url);
});

downloadBtn.disabled = true;

try {
  await loadExamples();
} catch {
  statusEl.textContent = 'Examples could not load. You can still type a description.';
}

promptEl.value = '';
showLiveSpec(DEFAULT_SPEC);
statusEl.textContent = 'Starting from the Arnacon messenger.';
buildFromCurrentSpec();
