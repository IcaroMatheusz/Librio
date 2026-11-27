import { Asset } from 'expo-asset';
import { File, FileMode, type Directory, type FileHandle } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { bytesToBase64, getComicPage, type ReaderPage } from '../lib/reader';
import { toByteArray } from 'base64-js';

const bundleAsset = require('../../assets/rar-reader.txt');
const CHUNK_BYTES = 192 * 1024;
const allowedExtensions = /^(jpe?g|png|webp|gif|avif)$/;

// Keep the initial WebView document small. The embedded WASM bundle is larger than a data URL can reliably carry.
const bootstrapHtml = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-librio-rar' 'wasm-unsafe-eval'"></head><body><script nonce="librio-rar">
  const parts=[];
  const notify=(type)=>window.ReactNativeWebView.postMessage(JSON.stringify({type}));
  window.LibrioBootstrap={
    append(part){ parts.push(part); notify('bundle-next'); },
    start(){
      const script=document.createElement('script');
      script.nonce='librio-rar';
      script.text=parts.join('');
      parts.length=0;
      document.body.appendChild(script);
    }
  };
  notify('boot');
</script></body></html>`;

type Props = {
  file: File;
  directory: Directory;
  coverOnly?: boolean;
  onStatus: (message: string) => void;
  onComplete: (pages: ReaderPage[]) => void;
  onError: (message: string) => void;
};

type Message =
  | { type: 'boot' | 'bundle-next' | 'ready' | 'next' | 'complete' | 'error' }
  | { type: 'page'; extension: string; total: number }
  | { type: 'data'; value: string }
  | { type: 'end' };

export default function RarExtractor({ file, directory, coverOnly = false, onStatus, onComplete, onError }: Props) {
  const [bundleReady, setBundleReady] = useState(false);
  const bundle = useRef({ code: '', offset: 0 });
  const webView = useRef<WebView<object>>(null);
  const reader = useRef<FileHandle | null>(null);
  const writer = useRef<FileHandle | null>(null);
  const current = useRef<File | null>(null);
  const pages = useRef<ReaderPage[]>([]);
  const active = useRef(true);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function closeHandles() {
    reader.current?.close();
    writer.current?.close();
    reader.current = null;
    writer.current = null;
    if (timeout.current) clearTimeout(timeout.current);
  }

  function fail(message = 'O CBR não pôde ser descompactado. Confira se o arquivo está completo e sem senha.') {
    if (!active.current) return;
    active.current = false;
    closeHandles();
    onError(message);
  }

  function resetTimeout() {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => fail('O leitor CBR parou de responder. Tente abrir o arquivo novamente.'), 120_000);
  }

  useEffect(() => {
    active.current = true;
    resetTimeout();
    void (async () => {
      try {
        const asset = await Asset.fromModule(bundleAsset).downloadAsync();
        if (!asset.localUri) throw new Error('RAR bundle unavailable');
        const code = await new File(asset.localUri).text();
        if (active.current) {
          bundle.current = { code, offset: 0 };
          setBundleReady(true);
        }
      } catch {
        fail('Não foi possível iniciar o leitor CBR.');
      }
    })();
    return () => {
      active.current = false;
      closeHandles();
    };
  }, [file]);

  function send(method: string, argument?: string, target = 'LibrioArchive') {
    webView.current?.injectJavaScript(`window.${target}.${method}(${argument === undefined ? '' : JSON.stringify(argument)});true;`);
  }

  async function receive(event: WebViewMessageEvent) {
    if (!active.current) return;
    try {
      const message = JSON.parse(event.nativeEvent.data) as Message;
      resetTimeout();
      switch (message.type) {
        case 'boot':
        case 'bundle-next': {
          const { code, offset } = bundle.current;
          if (offset < code.length) {
            bundle.current.offset += CHUNK_BYTES;
            send('append', code.slice(offset, offset + CHUNK_BYTES), 'LibrioBootstrap');
          } else {
            bundle.current.code = '';
            send('start', undefined, 'LibrioBootstrap');
          }
          break;
        }
        case 'ready':
          reader.current = file.open(FileMode.ReadOnly);
          // Fall through to the first chunk.
        case 'next': {
          const handle = reader.current;
          if (!handle) return;
          const remaining = file.size - (handle.offset ?? 0);
          if (remaining <= 0) {
            handle.close();
            reader.current = null;
            send('extract', coverOnly ? 'cover' : undefined);
          } else {
            const bytes = await handle.readBytes(Math.min(remaining, CHUNK_BYTES));
            if (active.current && bytes.length) send('append', bytesToBase64(bytes));
            else if (active.current) fail();
          }
          break;
        }
        case 'page': {
          if (!allowedExtensions.test(message.extension) || current.current) throw new Error('Invalid RAR entry');
          const target = new File(directory, `${pages.current.length + 1}.${message.extension}`);
          target.create();
          current.current = target;
          writer.current = target.open(FileMode.WriteOnly);
          onStatus(`Preparando página ${pages.current.length + 1} de ${message.total}…`);
          send('ack');
          break;
        }
        case 'data': {
          if (!writer.current) throw new Error('Missing RAR output');
          await writer.current.writeBytes(toByteArray(message.value));
          if (active.current) send('ack');
          break;
        }
        case 'end': {
          if (!writer.current || !current.current) throw new Error('Missing RAR output');
          writer.current.close();
          writer.current = null;
          const page = await getComicPage(current.current);
          if (!active.current) return;
          pages.current.push(page);
          current.current = null;
          send('ack');
          break;
        }
        case 'complete':
          if (!pages.current.length) throw new Error('Empty RAR archive');
          closeHandles();
          onComplete(pages.current);
          break;
        case 'error':
          fail();
          break;
      }
    } catch {
      fail();
    }
  }

  if (!bundleReady) return null;
  return (
    <View style={styles.worker} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <WebView<object>
        ref={webView}
        source={{ html: bootstrapHtml }}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={({ url }) => url === 'about:blank'}
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        onMessage={(event) => void receive(event)}
        onError={() => fail()}
        onRenderProcessGone={() => fail()}
        onContentProcessDidTerminate={() => fail()}
      />
    </View>
  );
}

const styles = StyleSheet.create({ worker: { position: 'absolute', width: 4, height: 4, opacity: 0 } });
