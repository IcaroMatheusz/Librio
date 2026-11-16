import { createApi } from '../node_modules/@bitplane/rars/browser/api.js';
import { createClient } from '../node_modules/@bitplane/rars/browser/client.js';
import { startWorker } from '../node_modules/@bitplane/rars/browser/worker-engine.js';
import init, * as wasm from '../node_modules/@bitplane/rars/browser/wasm/rars_wasm.js';

const wasmBase64 = '__LIBRIO_RAR_WASM_BASE64__';
const wasmBinary = Uint8Array.from(atob(wasmBase64), (character) => character.charCodeAt(0));

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
    readFile() { throw new Error('A leitura de caminhos do sistema não está disponível.'); },
    writeAtomic() { throw new Error('A gravação não está disponível no leitor.'); },
    writeVolumes() { throw new Error('A gravação não está disponível no leitor.'); },
  });
  return {
    post(message) { queueMicrotask(() => handleMessage?.(message)); },
    onMessage(callback) { listeners.add(callback); },
    onError() {},
    terminate() { listeners.clear(); },
  };
}

function asBlob(value) {
  if (value instanceof Blob) return value;
  if (value instanceof ArrayBuffer) return new Blob([value.slice(0)]);
  if (ArrayBuffer.isView(value)) return new Blob([value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)]);
  throw new TypeError('O arquivo CBR não pôde ser lido.');
}

const runtime = Object.assign(createClient(createInlineWorker), {
  version: '0.12.4',
  async prepareArchiveSources(input) {
    const inputs = Array.isArray(input) ? input : [input];
    if (!inputs.length) throw new TypeError('O arquivo CBR está vazio.');
    return inputs.map(asBlob);
  },
  prepareEntryData: asBlob,
  prepareOutputPath() { throw new TypeError('A gravação não está disponível no leitor.'); },
});
const { RarArchive } = createApi(runtime);

function post(type, data = {}) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({ type, ...data }));
}

function decodeBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }
  return btoa(binary);
}

function imageMime(name) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'avif') return 'image/avif';
  return 'image/png';
}

async function openArchive(encoded) {
  const root = document.getElementById('pages');
  root.replaceChildren();
  post('loading', { message: 'Organizando as páginas…' });
  let archive;
  try {
    const bytes = decodeBase64(encoded);
    archive = await RarArchive.open(bytes, {
      maxHeaderCount: 20000,
      maxTotalOutputBytes: 160 * 1024 * 1024,
      maxReaderWorkspaceBytes: 192 * 1024 * 1024,
    });
    const pages = archive.entries
      .filter((entry) => !entry.isDirectory && /\.(jpe?g|png|webp|gif|avif)$/i.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));
    if (!pages.length) throw new Error('Este CBR não contém páginas em formato de imagem.');
    if (pages.length > 2000) throw new Error('Este volume contém páginas demais para abrir de uma vez.');
    post('count', { total: pages.length });
    for (let index = 0; index < pages.length; index += 1) {
      const image = await pages[index].bytes({
        maxMemberOutputBytes: 64 * 1024 * 1024,
        maxTotalOutputBytes: 160 * 1024 * 1024,
        maxReaderWorkspaceBytes: 192 * 1024 * 1024,
      });
      const page = document.createElement('img');
      page.className = 'page';
      page.alt = `Página ${index + 1}`;
      page.src = `data:${imageMime(pages[index].name)};base64,${encodeBase64(image)}`;
      page.dataset.page = String(index + 1);
      root.appendChild(page);
      post('progress', { current: index + 1, total: pages.length });
    }
    const observer = new IntersectionObserver((changes) => {
      for (const change of changes) {
        if (change.isIntersecting) post('page', { current: Number(change.target.dataset.page), total: pages.length });
      }
    }, { threshold: 0.6 });
    root.querySelectorAll('.page').forEach((page) => observer.observe(page));
    document.getElementById('status')?.remove();
    post('ready', { total: pages.length });
  } catch (error) {
    post('error', { message: error instanceof Error ? error.message : 'Não foi possível abrir este arquivo CBR.' });
  } finally {
    archive?.close();
  }
}

(async () => {
  try {
    await init(wasmBinary);
    window.LibrioRarReader = { open: openArchive };
    post('ready-for-file');
  } catch (error) {
    post('error', { message: error instanceof Error ? error.message : 'Não foi possível iniciar o leitor CBR.' });
  }
})();
