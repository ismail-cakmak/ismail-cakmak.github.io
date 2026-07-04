import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite } from './build-site.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const host = process.env.HOST || '127.0.0.1';
const requestedPort = Number.parseInt(process.env.PORT || '4173', 10);
const pollInterval = Number.parseInt(process.env.PREVIEW_POLL_INTERVAL || '700', 10);
const liveReloadPath = '/__preview/events';
const liveReloadScript = `
<script>
  (() => {
    const events = new EventSource('/__preview/events');
    events.addEventListener('reload', () => window.location.reload());
  })();
</script>`;
const liveReloadClients = new Set();
const watchEntries = [
  'about.html',
  'blog.html',
  'css',
  'gallery.html',
  'github-pages-deploy',
  'images',
  'index.html',
  'js',
  'package.json',
  'post.html',
  'posts',
  'scripts/build-posts.mjs',
  'scripts/build-site.mjs'
];

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp']
]);

function sendMessage(response, statusCode, message) {
  response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(message);
}

function sendLiveReloadScript(html) {
  if (html.includes('</body>')) {
    return html.replace('</body>', `${liveReloadScript}\n</body>`);
  }

  return `${html}\n${liveReloadScript}`;
}

function handleLiveReload(request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
  response.write('\n');
  liveReloadClients.add(response);
  request.on('close', () => liveReloadClients.delete(response));
}

function notifyLiveReload() {
  for (const client of liveReloadClients) {
    client.write(`event: reload\ndata: ${Date.now()}\n\n`);
  }
}

function safePathFromUrl(url) {
  const decodedPath = decodeURIComponent(url.pathname);
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(distDir, normalizedPath);

  if (!filePath.startsWith(distDir)) {
    return null;
  }

  return filePath;
}

async function resolveFilePath(url) {
  const filePath = safePathFromUrl(url);

  if (!filePath) {
    return null;
  }

  const fileStats = await stat(filePath).catch(() => null);

  if (fileStats?.isDirectory()) {
    return path.join(filePath, 'index.html');
  }

  if (fileStats?.isFile()) {
    return filePath;
  }

  if (!path.extname(filePath)) {
    const routeIndexPath = path.join(filePath, 'index.html');
    const routeStats = await stat(routeIndexPath).catch(() => null);

    if (routeStats?.isFile()) {
      return routeIndexPath;
    }
  }

  return null;
}

async function serveFile(filePath, response) {
  const extension = path.extname(filePath);

  if (extension === '.html') {
    const html = await readFile(filePath, 'utf8');
    response.writeHead(200, {
      'Content-Type': contentTypes.get(extension)
    });
    response.end(sendLiveReloadScript(html));
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes.get(extension) || 'application/octet-stream'
  });
  createReadStream(filePath).pipe(response);
}

async function collectWatchedFiles(entryPath, files) {
  const absolutePath = path.join(projectRoot, entryPath);
  const entryStats = await stat(absolutePath).catch(() => null);

  if (!entryStats) {
    return;
  }

  if (entryStats.isFile()) {
    files.set(entryPath, `${entryStats.size}:${entryStats.mtimeMs}`);
    return;
  }

  if (!entryStats.isDirectory()) {
    return;
  }

  const entries = await readdir(absolutePath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === '.DS_Store') {
      continue;
    }

    await collectWatchedFiles(path.join(entryPath, entry.name), files);
  }
}

async function getWatchSignature() {
  const files = new Map();

  for (const entry of watchEntries) {
    await collectWatchedFiles(entry, files);
  }

  return Array.from(files.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, fingerprint]) => `${filePath}:${fingerprint}`)
    .join('\n');
}

function createRebuilder() {
  let building = false;
  let queued = false;

  const rebuild = async () => {
    if (building) {
      queued = true;
      return;
    }

    building = true;

    try {
      await buildSite();
      console.log(`Rebuilt at ${new Date().toLocaleTimeString()}.`);
      notifyLiveReload();
    } catch (error) {
      console.error(`Preview rebuild failed: ${error.message}`);
    } finally {
      building = false;
    }

    if (queued) {
      queued = false;
      await rebuild();
    }
  };

  return rebuild;
}

async function watchForChanges() {
  let previousSignature = await getWatchSignature();
  const rebuild = createRebuilder();

  setInterval(async () => {
    try {
      const nextSignature = await getWatchSignature();

      if (nextSignature === previousSignature) {
        return;
      }

      previousSignature = nextSignature;
      await rebuild();
    } catch (error) {
      console.error(`Preview watcher failed: ${error.message}`);
    }
  }, pollInterval);
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = error => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

async function startServer() {
  for (let port = requestedPort; port < requestedPort + 10; port += 1) {
    const server = createServer(async (request, response) => {
      const requestUrl = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);

      if (requestUrl.pathname === liveReloadPath) {
        handleLiveReload(request, response);
        return;
      }

      const filePath = await resolveFilePath(requestUrl);

      if (!filePath) {
        sendMessage(response, 404, 'Not found');
        return;
      }

      await serveFile(filePath, response);
    });

    try {
      await listen(server, port);
      console.log(`Preview: http://${host}:${port}/`);
      console.log('Auto-rebuild is on. Save a post and refreshes happen in the browser.');
      console.log('Press Ctrl+C to stop.');
      return;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') {
        throw error;
      }

      console.log(`Port ${port} is already in use, trying ${port + 1}...`);
    }
  }

  throw new Error(`No available preview port found from ${requestedPort} to ${requestedPort + 9}.`);
}

await buildSite();
await startServer();
await watchForChanges();
