import { File, type Directory } from 'expo-file-system';
import { Image } from 'react-native';
import { fromByteArray } from 'base64-js';
import { ZipBook } from './zipBook';
import { nativeMedia } from './nativeMedia';

export type ReaderPage = { uri: string; aspectRatio: number };
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif)$/i;

export async function getComicPage(file: File): Promise<ReaderPage> {
  const size = await Image.getSize(file.uri).catch(() => null);
  return { uri: file.uri, aspectRatio: size && size.width > 0 && size.height > 0 ? size.width / size.height : 0.72 };
}

export const bytesToBase64 = fromByteArray;

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

export async function extractNativeComic(file: File, directory: Directory, signal: AbortSignal, coverOnly = false) {
  if (!nativeMedia?.extractComic) return null;
  if (signal.aborted) throw new Error('Extração cancelada.');
  const jobId = directory.uri;
  const cancel = () => nativeMedia?.cancelComic?.(jobId);
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const found = await nativeMedia.extractComic(file.uri, directory.uri, coverOnly, jobId);
    if (signal.aborted) throw new Error('Extração cancelada.');
    return found.sort((left, right) => compareNatural(left.name, right.name));
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

export async function readComicZip(uri: string, folder: Directory, signal: AbortSignal, coverOnly = false): Promise<ReaderPage[]> {
  const archive = await ZipBook.open(uri);
  try {
    const entries = [...archive.entries.values()].filter((entry) => entry.size > 0 && IMAGE_EXTENSIONS.test(entry.name))
      .sort((left, right) => compareNatural(left.name, right.name));
    if (!entries.length) throw new Error('O arquivo CBZ não contém páginas de imagem compatíveis.');
    const pages: ReaderPage[] = [];
    for (const entry of coverOnly ? entries.slice(0, 1) : entries) {
      if (signal.aborted) break;
      const target = new File(folder, `${pages.length + 1}.${entry.name.split('.').pop()?.toLowerCase()}`);
      await archive.extract(entry, target, signal);
      pages.push(coverOnly ? { uri: target.uri, aspectRatio: 0.72 } : await getComicPage(target));
    }
    return pages;
  } finally {
    archive.close();
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

async function epubPackage(archive: ZipBook) {
  const container = await archive.read('META-INF/container.xml');
  if (!container) throw new Error('Este EPUB não possui um índice válido.');
  const rootFileTag = decodeText(container).match(/<rootfile\b[^>]*>/i)?.[0] ?? '';
  const opfPath = xmlAttribute(rootFileTag, 'full-path');
  const opf = await archive.read(opfPath);
  if (!opf) throw new Error('Não foi possível encontrar o conteúdo deste EPUB.');

  const packageXml = decodeText(opf);
  const coverId = [...packageXml.matchAll(/<meta\b[^>]*>/gi)]
    .map(([tag]) => tag).find((tag) => xmlAttribute(tag, 'name').toLowerCase() === 'cover');
  const legacyCover = coverId ? xmlAttribute(coverId, 'content') : '';
  const manifest = new Map<string, string>();
  let cover = '';
  for (const [tag] of packageXml.matchAll(/<item\b[^>]*>/gi)) {
    const id = xmlAttribute(tag, 'id');
    const href = xmlAttribute(tag, 'href');
    const properties = xmlAttribute(tag, 'properties').split(/\s+/);
    if (!id || !href) continue;
    const path = resolvePath(opfPath.split('/').slice(0, -1).join('/'), href);
    if (!properties.includes('nav')) manifest.set(id, path);
    if (properties.includes('cover-image') || (!cover && id === legacyCover)) cover = path;
  }
  const chapters = [...packageXml.matchAll(/<itemref\b[^>]*>/gi)].flatMap(([tag]) => {
    const path = manifest.get(xmlAttribute(tag, 'idref'));
    return path && archive.entries.has(path) ? [path] : [];
  });
  return { cover, chapters, images: [...manifest.values()].filter((path) => IMAGE_EXTENSIONS.test(path)) };
}

export async function extractEpubCover(uri: string, folder: Directory, signal: AbortSignal) {
  const archive = await ZipBook.open(uri);
  try {
    const { cover, chapters, images } = await epubPackage(archive);
    let path = cover && IMAGE_EXTENSIONS.test(cover) ? cover : '';
    if (!path && chapters[0] && !signal.aborted) {
      const first = await archive.read(chapters[0]);
      const image = first && decodeText(first).match(/<(?:img|image)\b[^>]*?\s(?:src|href|xlink:href)=["']([^"']+)["']/i)?.[1];
      if (image) path = resolvePath(chapters[0].split('/').slice(0, -1).join('/'), image);
    }
    const entry = archive.entries.get(path) ?? archive.entries.get(images[0]);
    if (!entry || signal.aborted) return undefined;
    const target = new File(folder, `cover.${entry.name.split('.').pop()?.toLowerCase()}`);
    await archive.extract(entry, target, signal);
    return target.uri;
  } finally {
    archive.close();
  }
}

async function inlineChapterAssets(content: string, chapterPath: string, archive: ZipBook) {
  const safe = content.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<script\b[^>]*\/>/gi, '').replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '');
  const assets = /\s(src|poster|xlink:href)=(['"])(.*?)\2/gi;
  const result: string[] = [];
  let offset = 0;
  for (const match of safe.matchAll(assets)) {
    const [, attribute, quote, href] = match;
    const path = resolvePath(chapterPath.split('/').slice(0, -1).join('/'), href);
    const data = IMAGE_EXTENSIONS.test(path) ? await archive.read(path) : undefined;
    if (!data) continue;
    result.push(safe.slice(offset, match.index), ` ${attribute}=${quote}data:${mimeFor(path)};base64,${bytesToBase64(data)}${quote}`);
    offset = match.index + match[0].length;
  }
  result.push(safe.slice(offset));
  return result.join('');
}

export async function readEpubHtml(uri: string, fontScale: number, initialProgress = 0, signal?: AbortSignal) {
  const archive = await ZipBook.open(uri);
  const chapters: string[] = [];
  try {
    const publication = await epubPackage(archive);
    for (const path of publication.chapters) {
      if (signal?.aborted) throw new Error('Extração cancelada.');
      const text = await archive.read(path);
      if (!text) continue;
      const markup = await inlineChapterAssets(decodeText(text), path, archive);
      const body = markup.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? markup;
      chapters.push(`<section class="chapter">${body}</section>`);
    }
  } finally {
    archive.close();
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
