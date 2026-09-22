const crypto = require('node:crypto');
const vscode = require('vscode');

const VIEW_ID = 'arnacon.sidebar';
const RELAY_ORIGIN = 'wss://arnacon-phone-relay-proxy-zmu4vmardq-ew.a.run.app';
// Audio calls gather ICE against the STUN servers in host/ice-config.mjs.
const STUN_ORIGINS = 'stun: stuns:';

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
      `connect-src ${RELAY_ORIGIN} ${STUN_ORIGINS}`,
      'media-src blob: mediastream:',
      "webrtc 'allow'",
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
