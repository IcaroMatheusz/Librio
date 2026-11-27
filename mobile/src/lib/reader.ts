import { inflateSync, strFromU8, unzipSync } from 'fflate';
import { File, FileMode, type Directory } from 'expo-file-system';
import { Image } from 'react-native';
import { fromByteArray } from 'base64-js';

export type ReaderPage = { uri: string; aspectRatio: number };

export async function getComicPage(file: File): Promise<ReaderPage> {
  const size = await Image.getSize(file.uri).catch(() => null);
  return { uri: file.uri, aspectRatio: size && size.width > 0 && size.height > 0 ? size.width / size.height : 0.72 };
}
const MAX_ARCHIVE_INPUT = 180 * 1024 * 1024;
const MAX_ARCHIVE_OUTPUT = 300 * 1024 * 1024;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif)$/i;

function base64(bytes: Uint8Array) {
  return fromByteArray(bytes);
}

function mimeFor(name: string) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'avif') return 'image/avif';
  return 'image/png';
}

function compareNatural(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

async function readZip(uri: string) {
  const source = new File(uri);
  if (source.size > MAX_ARCHIVE_INPUT) throw new Error('Este arquivo é grande demais para abrir no leitor local (limite de 180 MB).');
  const bytes = new Uint8Array(await source.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tailStart = Math.max(0, bytes.byteLength - 65_557);
  let endRecord = -1;
  for (let offset = bytes.byteLength - 22; offset >= tailStart; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.byteLength) { endRecord = offset; break; }
  }
  if (endRecord < 0) throw new Error('Este arquivo compactado está incompleto ou inválido.');
  let cursor = view.getUint32(endRecord + 16, true);
  const entryCount = view.getUint16(endRecord + 10, true);
  let expandedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.byteLength || view.getUint32(cursor, true) !== 0x02014b50) throw new Error('O índice deste arquivo compactado não é válido.');
    const size = view.getUint32(cursor + 24, true);
    if (size === 0xffffffff) throw new Error('Arquivos ZIP64 ainda não são compatíveis com o leitor.');
    expandedBytes += size;
    if (expandedBytes > MAX_ARCHIVE_OUTPUT) throw new Error('O conteúdo descompactado ultrapassa o limite seguro de 300 MB.');
    cursor += 46 + view.getUint16(cursor + 28, true) + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
  }
  return unzipSync(bytes, {
    filter(file) {
      return !file.name.startsWith('__MACOSX/') &&
        !file.name.split('/').some((segment) => segment === '..' || segment.startsWith('.'));
    },
  });
}

export async function readComicZip(uri: string, folder: Directory, isActive: () => boolean): Promise<ReaderPage[]> {
  const file = new File(uri);
  const handle = file.open(FileMode.ReadOnly);
  try {
    const invalid = 'O índice deste arquivo CBZ está incompleto ou inválido.';
    async function readAt(offset: number, length: number) {
      if (offset < 0 || length < 0 || offset + length > file.size) throw new Error(invalid);
      handle.offset = offset;
      const bytes = await handle.readBytes(length);
      if (bytes.length !== length) throw new Error(invalid);
      return bytes;
    }

    const tailOffset = Math.max(0, file.size - 65_557);
    const end = await readAt(tailOffset, file.size - tailOffset);
    const tail = new DataView(end.buffer, end.byteOffset, end.byteLength);
    let footer = end.length - 22;
    while (footer >= 0 && (tail.getUint32(footer, true) !== 0x06054b50 ||
      footer + 22 + tail.getUint16(footer + 20, true) !== end.length)) footer -= 1;
    if (footer < 0 || tail.getUint32(footer + 4, true) !== 0) throw new Error(invalid);
    const entryCount = tail.getUint16(footer + 10, true);
    const indexSize = tail.getUint32(footer + 12, true);
    const indexOffset = tail.getUint32(footer + 16, true);
    if (indexSize > 16 * 1024 * 1024 || indexOffset + indexSize > tailOffset + footer) throw new Error(invalid);

    const index = await readAt(indexOffset, indexSize);
    const central = new DataView(index.buffer, index.byteOffset, index.byteLength);
    const entries: { name: string; flags: number; method: number; compressed: number; size: number; offset: number }[] = [];
    let cursor = 0;
    let expanded = 0;
    for (let entry = 0; entry < entryCount; entry += 1) {
      if (cursor + 46 > index.length || central.getUint32(cursor, true) !== 0x02014b50) throw new Error(invalid);
      const flags = central.getUint16(cursor + 8, true);
      const method = central.getUint16(cursor + 10, true);
      const compressed = central.getUint32(cursor + 20, true);
      const size = central.getUint32(cursor + 24, true);
      const nameOffset = cursor + 46;
      const nameEnd = nameOffset + central.getUint16(cursor + 28, true);
      const offset = central.getUint32(cursor + 42, true);
      cursor = nameEnd + central.getUint16(cursor + 30, true) + central.getUint16(cursor + 32, true);
      if (cursor > index.length) throw new Error(invalid);
      const name = strFromU8(index.subarray(nameOffset, nameEnd), !(flags & 0x800));
      if (!size || !IMAGE_EXTENSIONS.test(name) || name.split('/').some((part) => part === '__MACOSX' || part.startsWith('.'))) continue;
      expanded += size;
      if (expanded > 512 * 1024 * 1024 || Math.max(size, compressed) > 48 * 1024 * 1024) {
        throw new Error('As imagens deste CBZ ultrapassam os limites do leitor móvel.');
      }
      entries.push({ name, flags, method, compressed, size, offset });
    }

    if (!entries.length) throw new Error('O arquivo CBZ não contém páginas de imagem compatíveis.');
    entries.sort((left, right) => compareNatural(left.name, right.name));
    const pages: ReaderPage[] = [];
    for (const { name, flags, method, compressed, size, offset } of entries) {
      if (!isActive()) break;
      if (flags & 1 || (method !== 0 && method !== 8)) throw new Error('O CBZ usa criptografia ou compactação incompatível.');
      const header = await readAt(offset, 30);
      const fields = new DataView(header.buffer, header.byteOffset, header.byteLength);
      if (fields.getUint32(0, true) !== 0x04034b50) throw new Error(invalid);
      const start = offset + 30 + fields.getUint16(26, true) + fields.getUint16(28, true);
      if (!compressed || start + compressed > indexOffset) throw new Error(invalid);
      const input = await readAt(start, compressed);
      const bytes = method === 8 ? inflateSync(input, { out: new Uint8Array(size) }) : input;
      if (bytes.length !== size) throw new Error(invalid);
      if (!isActive()) break;
      const target = new File(folder, `${pages.length + 1}.${name.split('.').pop()?.toLowerCase()}`);
      target.create();
      await target.write(bytes);
      pages.push(await getComicPage(target));
    }
    return pages;
  } finally {
    handle.close();
  }
}

function xmlAttribute(tag: string, attribute: string) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] ?? '';
}

function resolvePath(base: string, relative: string) {
  if (!relative || /^[a-z][a-z\d+.-]*:/i.test(relative) || relative.startsWith('#')) return relative;
  const target = relative.split('#')[0].split('?')[0];
  let decoded = target;
  try { decoded = decodeURIComponent(target); } catch { /* Some EPUB paths contain literal percent signs. */ }
  const parts = `${base}/${decoded}`.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}

function decodeText(bytes: Uint8Array) {
  return new TextDecoder('utf-8').decode(bytes);
}

function inlineChapterAssets(content: string, chapterPath: string, files: Record<string, Uint8Array>) {
  let result = content.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<script\b[^>]*\/>/gi, '').replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '');
  result = result.replace(/\s(src|poster)=(['"])(.*?)\2/gi, (match, attribute: string, quote: string, source: string) => {
    const path = resolvePath(chapterPath.split('/').slice(0, -1).join('/'), source);
    const bytes = files[path];
    if (!bytes || !IMAGE_EXTENSIONS.test(path) || bytes.length > 20 * 1024 * 1024) return match;
    return ` ${attribute}=${quote}data:${mimeFor(path)};base64,${base64(bytes)}${quote}`;
  });
  return result;
}

export async function readEpubHtml(
  uri: string,
  fontScale: number,
  initialProgress = 0
) {
  const files = await readZip(uri);
  const container = files['META-INF/container.xml'];
  if (!container) throw new Error('Este EPUB não possui um índice válido.');
  const rootFileTag = decodeText(container).match(/<rootfile\b[^>]*>/i)?.[0] ?? '';
  const opfPath = xmlAttribute(rootFileTag, 'full-path');
  const opf = files[opfPath];
  if (!opfPath || !opf) throw new Error('Não foi possível encontrar o conteúdo deste EPUB.');

  const packageXml = decodeText(opf);
  const manifest = new Map<string, string>();
  for (const item of packageXml.matchAll(/<item\b[^>]*>/gi)) {
    const id = xmlAttribute(item[0], 'id');
    const href = xmlAttribute(item[0], 'href');
    const properties = xmlAttribute(item[0], 'properties');
    if (id && href && !properties.split(/\s+/).includes('nav')) manifest.set(id, resolvePath(opfPath.split('/').slice(0, -1).join('/'), href));
  }
  const chapters: string[] = [];
  for (const reference of packageXml.matchAll(/<itemref\b[^>]*>/gi)) {
    const filePath = manifest.get(xmlAttribute(reference[0], 'idref'));
    const chapter = filePath ? files[filePath] : undefined;
    if (!filePath || !chapter) continue;
    const markup = inlineChapterAssets(decodeText(chapter), filePath, files);
    const body = markup.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? markup;
    chapters.push(`<section class="chapter">${body}</section>`);
  }
  if (!chapters.length) throw new Error('O EPUB não possui capítulos de texto legíveis.');
  const safeScale = Math.max(0.85, Math.min(1.6, fontScale));
  const content = chapters.join('<div class="page-break"></div>');
  const startAt = Math.max(0, Math.min(100, initialProgress));
  const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'nonce-${nonce}'; form-action 'none'; base-uri 'none'"><style>
    :root{color-scheme:dark;background:#100e16;--reading-size:${18 * safeScale}px}
    *{box-sizing:border-box}
    body{
      margin:0 auto;
      padding:clamp(24px,5vw,52px) clamp(22px,7vw,66px) 100px;
      overflow-wrap:anywhere;
      max-width:820px;
      background:#100e16;
      color:#f2eff9;
      font:var(--reading-size)/1.8 Georgia, serif;
      letter-spacing:.01em;
    }
    img{max-width:100%;height:auto;display:block;margin:24px auto;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,0.35)}
    p{margin:0 0 1.25em}
    h1,h2,h3{font-family:system-ui,-apple-system,sans-serif;line-height:1.3;color:#ffffff;margin:1.6em 0 .7em}
    a{color:#c4b5fd;text-decoration:none}
    blockquote{border-inline-start:3px solid #a78bfa;padding-inline-start:16px;color:#c1bfd0;margin:1.4em 0}
    svg,table,pre{max-width:100%;overflow:auto}
    .chapter{padding-bottom:36px}
    .page-break{height:1px;margin:40px 0;background:rgba(255,255,255,0.08)}
    body{overflow-anchor:none}
  </style></head><body>${content}<script nonce="${nonce}">
    (()=>{
      let position=${startAt / 100};
      let last=0;
      const range=()=>Math.max(0,document.documentElement.scrollHeight-innerHeight);
      const post=(type,data)=>window.ReactNativeWebView?.postMessage(JSON.stringify({type,...data}));
      function restore(){ window.scrollTo(0,range()*position); }
      window.addEventListener('load',()=>{ restore(); post('ready'); });
      window.addEventListener('resize',restore);
      window.addEventListener('scroll',()=>{
        clearTimeout(last);
        last=setTimeout(()=>{
          position=range()?scrollY/range():1;
          post('progress',{progress:position*100});
        },140);
      });
      window.LibrioTextSize=(scale)=>{
        document.documentElement.style.setProperty('--reading-size',18*scale+'px');
        restore();
      };
      document.addEventListener('click',(event)=>{
        if(event.target.closest('a')) return;
        if(!window.getSelection()?.toString()) post('tap');
      });
    })();
  </script></body></html>`;
}

export function bytesToBase64(bytes: Uint8Array) {
  return base64(bytes);
}
