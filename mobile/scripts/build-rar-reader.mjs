import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform === 'win32' && !process.env.ESBUILD_BINARY_PATH) {
  const localBinary = path.join(root, 'node_modules/@esbuild/win32-x64/esbuild.exe');
  try { await access(localBinary); process.env.ESBUILD_BINARY_PATH = localBinary; } catch { /* O esbuild resolver encontra o binário nativo nas demais plataformas. */ }
}
const wasmPath = path.join(root, 'node_modules/@bitplane/rars/browser/wasm/rars_wasm_bg.wasm');
const entryPath = path.join(root, 'reader-build/rar-entry.js');
const outPath = path.join(root, 'assets/rar-reader.txt');
const wasmBase64 = (await readFile(wasmPath)).toString('base64');
const entry = (await readFile(entryPath, 'utf8')).replace('__LIBRIO_RAR_WASM_BASE64__', wasmBase64);
const result = await build({
  stdin: { contents: entry, resolveDir: path.dirname(entryPath), sourcefile: 'rar-entry.js', loader: 'js' },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  write: false,
  supported: { 'import-meta': false },
  logLevel: 'warning',
});
await writeFile(outPath, result.outputFiles[0].contents);
console.log(`Leitor CBR offline gerado: ${path.relative(root, outPath)}`);
