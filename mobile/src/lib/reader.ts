import { unzipSync } from 'fflate';
import { Directory, File, Paths } from 'expo-file-system';
import { fromByteArray } from 'base64-js';

export type ReaderPage = { name: string; uri: string };
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
      return !file.name.split('/').some((segment) => segment === '..');
    },
  });
}

export async function readComicZip(uri: string): Promise<ReaderPage[]> {
  const files = await readZip(uri);
  const entries = Object.entries(files)
    .filter(([name, bytes]) => bytes.length > 0 && IMAGE_EXTENSIONS.test(name))
    .sort(([left], [right]) => compareNatural(left, right));
  if (!entries.length) throw new Error('O arquivo CBZ não contém páginas de imagem compatíveis.');
  const key = [...uri].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261).toString(16);
  const folder = new Directory(Paths.cache, 'librio-pages', key);
  if (folder.exists) folder.delete();
  folder.create({ intermediates: true });
  const result: ReaderPage[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const [name, bytes] = entries[index];
    const extension = name.split('.').pop()?.toLowerCase() ?? 'png';
    const target = new File(folder, `${String(index + 1).padStart(5, '0')}.${extension}`);
    await target.write(bytes);
    result.push({ name, uri: target.uri });
  }
  return result;
}

function xmlAttribute(tag: string, attribute: string) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] ?? '';
}

function resolvePath(base: string, relative: string) {
  if (!relative || /^[a-z][a-z\d+.-]*:/i.test(relative) || relative.startsWith('#')) return relative;
  const parts = `${base}/${decodeURIComponent(relative.split('#')[0].split('?')[0])}`.split('/');
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
  initialProgress = 0,
  readingMode: 'page' | 'manga' | 'vertical' = 'vertical'
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
  const isRtl = readingMode === 'manga';

  return `<!doctype html><html dir="${isRtl ? 'rtl' : 'ltr'}"><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><meta charset="utf-8"><style>
    :root{color-scheme:dark}
    *{box-sizing:border-box}
    body{
      margin:0 auto;
      padding:28px 24px 88px;
      max-width:820px;
      background:#171a27;
      color:#f2eff9;
      font:${18 * safeScale}px/1.8 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Georgia, serif;
      letter-spacing:.01em;
      ${isRtl ? 'direction:rtl;text-align:right;' : 'direction:ltr;text-align:left;'}
    }
    img{max-width:100%;height:auto;display:block;margin:24px auto;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,0.35)}
    p{margin:0 0 1.25em}
    h1,h2,h3{font-family:system-ui,-apple-system,sans-serif;line-height:1.3;color:#ffffff;margin:1.6em 0 .7em}
    a{color:#c4b5fd;text-decoration:none}
    blockquote{border-${isRtl ? 'right' : 'left'}:3px solid #a78bfa;padding-${isRtl ? 'right' : 'left'}:16px;color:#c1bfd0;margin:1.4em 0}
    .chapter{padding-bottom:36px}
    .page-break{height:1px;margin:40px 0;background:rgba(255,255,255,0.08)}
  </style></head><body>${content}<script>
    let last=0;
    window.addEventListener('scroll',()=>{
      clearTimeout(last);
      last=setTimeout(()=>{
        const max=document.documentElement.scrollHeight-innerHeight;
        const progress=max>0?Math.round(scrollY/max*100):100;
        window.ReactNativeWebView?.postMessage(JSON.stringify({type:'progress',progress}));
      },180);
    });
    window.addEventListener('load',()=>window.scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*${startAt / 100}));
  </script></body></html>`;
}

export function bytesToBase64(bytes: Uint8Array) {
  return base64(bytes);
}
