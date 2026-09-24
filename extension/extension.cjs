const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vscode = require('vscode');

const VIEW_ID = 'arnacon.sidebar';
const RELAY_ORIGIN = 'wss://arnacon-phone-relay-proxy-zmu4vmardq-ew.a.run.app';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * Cursor webviews are denied microphone access by the iframe permissions
 * policy, so calls run on the host page instead. Serving it over loopback
 * (not file://) keeps it a secure context, which getUserMedia requires.
 */
let callHost = null;

function startCallHost(root) {
  if (callHost) return Promise.resolve(callHost.origin);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const requested = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
      const file = path.normalize(path.join(root, requested === '/' ? '/host/index.html' : requested));
      if (path.relative(root, file).startsWith('..') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      callHost = { server, origin: `http://127.0.0.1:${server.address().port}` };
      resolve(callHost.origin);
    });
  });
}

function stopCallHost() {
  if (!callHost) return;
  callHost.server.close();
  callHost = null;
}

async function openCallPage(root, { sessionId, sessionName } = {}) {
  const origin = await startCallHost(root);
  const params = new URLSearchParams({ screen: 'CHAT' });
  if (sessionId) params.set('sessionId', String(sessionId));
  if (sessionName) params.set('sessionName', String(sessionName));
  await vscode.env.openExternal(vscode.Uri.parse(`${origin}/host/index.html#${params}`));
}

class ArnaconViewProvider {
  constructor(extensionUri) {
    this.extensionUri = extensionUri;
  }

  resolveWebviewView(webviewView) {
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webview.html = this.getHtml(webview);
    webviewView.onDidDispose(stopCallHost);
    webview.onDidReceiveMessage(async (message) => {
      if (message?.type !== 'open-call') return;
      try {
        await openCallPage(this.extensionUri.fsPath, message);
      } catch (error) {
        vscode.window.showErrorMessage(`Arnacon could not open the call page: ${error.message}`);
      }
    });
  }

  getHtml(webview) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'extension', 'webview.mjs'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'extension', 'webview.css'),
    );
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}' ${webview.cspSource} https://cdn.jsdelivr.net`,
      `connect-src ${RELAY_ORIGIN}`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arnacon</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <main id="app" aria-live="polite"></main>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function activate(context) {
  const provider = new ArnaconViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
