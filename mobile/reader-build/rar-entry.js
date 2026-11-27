import { createApi } from '../node_modules/@bitplane/rars/browser/api.js';
import { createClient } from '../node_modules/@bitplane/rars/browser/client.js';
import { startWorker } from '../node_modules/@bitplane/rars/browser/worker-engine.js';
import init, * as wasm from '../node_modules/@bitplane/rars/browser/wasm/rars_wasm.js';

const wasmBase64 = '__LIBRIO_RAR_WASM_BASE64__';
const outputLimit = 160 * 1024 * 1024;
const workspaceLimit = 192 * 1024 * 1024;
const chunkSize = 192 * 1024;
const parts = [];
let acknowledge;

function createInlineWorker() {
  const listeners = new Set();
  let handleMessage;
  const port = {
    onMessage(callback) { handleMessage = callback; },
    post(message) {
      queueMicrotask(() => listeners.forEach((listener) => listener(message)));
    },
  };
  startWorker(port, wasm, {
    readFile() { throw new Error('Filesystem access unavailable'); },
    writeAtomic() { throw new Error('Write unavailable'); },
    writeVolumes() { throw new Error('Write unavailable'); },
  });
  return {
    post(message) { queueMicrotask(() => handleMessage?.(message)); },
    onMessage(callback) { listeners.add(callback); },
    onError() {},
    terminate() { listeners.clear(); },
  };
}

const runtime = Object.assign(createClient(createInlineWorker), {
  version: '0.12.4',
  async prepareArchiveSources(input) {
    if (!(input instanceof Blob) || !input.size) throw new TypeError('Empty CBR');
    return [input];
  },
  prepareOutputPath() { throw new TypeError('Write unavailable'); },
});
const { RarArchive } = createApi(runtime);

function post(type, data = {}) {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
}

function send(type, data) {
  return new Promise((resolve) => {
    acknowledge = resolve;
    post(type, data);
  });
}

function decodeBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function encodeBase64(bytes) {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}

async function extract() {
  let archive;
  try {
    const input = new Blob(parts);
    parts.length = 0;
    archive = await RarArchive.open(input, {
      maxHeaderCount: 20000,
      maxTotalOutputBytes: outputLimit,
      maxReaderWorkspaceBytes: workspaceLimit,
    });
    const pages = archive.entries
      .filter((entry) => !entry.isDirectory && /\.(jpe?g|png|webp|gif|avif)$/i.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));
    if (!pages.length || pages.length > 2000) throw new Error('Invalid page count');
    let totalOutput = 0;
    for (const page of pages) {
      const image = await page.bytes({
        maxMemberOutputBytes: 64 * 1024 * 1024,
        maxTotalOutputBytes: outputLimit,
        maxReaderWorkspaceBytes: workspaceLimit,
      });
      totalOutput += image.length;
      if (!image.length || totalOutput > outputLimit) throw new Error('Invalid archive size');
      await send('page', { extension: page.name.split('.').pop().toLowerCase(), total: pages.length });
      for (let offset = 0; offset < image.length; offset += chunkSize) {
        await send('data', { value: encodeBase64(image.subarray(offset, offset + chunkSize)) });
      }
      await send('end');
    }
    post('complete');
  } catch {
    post('error');
  } finally {
    archive?.close();
  }
}

(async () => {
  try {
    await init({ module_or_path: decodeBase64(wasmBase64) });
    window.LibrioArchive = {
      append(encoded) {
        parts.push(decodeBase64(encoded));
        post('next');
      },
      extract,
      ack() {
        const resume = acknowledge;
        acknowledge = undefined;
        resume?.();
      },
    };
    post('ready');
  } catch {
    post('error');
  }
})();
