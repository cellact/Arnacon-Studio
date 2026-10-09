import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HOST_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export function createHostServer(root = HOST_ROOT) {
  return createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/host/index.html';
    const file = normalize(join(root, path));
    if (relative(root, file).startsWith('..') || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const headers = {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    };
    if (extname(file) === '.mjs') headers['Access-Control-Allow-Origin'] = '*';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  });
}

function listenMain() {
  const port = Number(process.env.PORT || 4175);
  const server = createHostServer();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Open http://127.0.0.1:${port}/`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, () => {
    console.log(`Arnacon host (Ploy/Base44 skin) at http://127.0.0.1:${port}/`);
    console.log('WebView product URL: this origin. Skin files: /skin/');
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) listenMain();
