import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Action, BookIcon, palette } from '../../src/components/atoms';
import ComicReader from '../../src/components/ComicReader';
import PdfReader, { type ReadingMode } from '../../src/components/PdfReader';
import RarExtractor from '../../src/components/RarExtractor';
import { getBookProgress, getBookUrl, markBookOpened, saveBookProgress } from '../../src/lib/library';
import { findLocalBook, getLocalFile, localProgressKey, reconnectLocalBook } from '../../src/lib/local';
import { extractNativeComic, readComicZip, readEpubHtml, type ReaderPage } from '../../src/lib/reader';
import { requireSupabase } from '../../src/lib/supabase';
import { getReadingFormat, type Book, type LocalBook, type ReadingFormat } from '../../src/lib/types';
import { estimateRemaining, sampleReadingPace, type ReadingPace } from '../../src/lib/readingPace';
import { saveAutomaticCover } from '../../src/lib/localCovers';

type Source = { file: File; format: ReadingFormat; title: string; key: string; cloudId?: string; localBook?: LocalBook };
type Checkpoint = { percent: number; page?: number; pace?: ReadingPace };
const modes: { value: ReadingMode; label: string }[] = [
  { value: 'page', label: 'Páginas' },
  { value: 'manga', label: 'Mangá' },
  { value: 'vertical', label: 'Rolagem' },
];
const cloudDownloads = new Map<string, Promise<File>>();
const progressWrites = new Map<string, Promise<void>>();

function boundPercent(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

function validPace(value: ReadingPace | undefined) {
  return value && Number.isFinite(value.seconds) && value.seconds > 0 && Number.isFinite(value.fraction) && value.fraction > 0 ? value : undefined;
}

async function cacheCloudBook(book: Book, format: ReadingFormat) {
  const folder = new Directory(Paths.cache, 'librio-reader-v2');
  folder.create({ idempotent: true, intermediates: true });
  const target = new File(folder, `${book.id}.${format}`);
  if (target.exists && target.size > 0) return target;
  const pending = cloudDownloads.get(book.id);
  if (pending) return pending;

  const temp = new File(folder, `${book.id}.part`);
  const download = (async () => {
    try {
      const url = await getBookUrl(book);
      await File.downloadFileAsync(url, temp, { idempotent: true });
      if (!temp.size) throw new Error('Download vazio');
      await temp.move(target, { overwrite: true });
      return target;
    } finally {
      cloudDownloads.delete(book.id);
      if (temp.exists && temp.uri !== target.uri) temp.delete();
    }
  })();
  cloudDownloads.set(book.id, download);
  return download;
}

async function readCheckpoint(source: Source) {
  const saved = await AsyncStorage.getItem(source.key).catch(() => null);
  let device: Checkpoint = { percent: 0 };
  try {
    const data = JSON.parse(saved ?? '0');
    device = typeof data === 'number'
      ? { percent: boundPercent(data) }
      : { percent: boundPercent(data.percent), page: Number.isInteger(data.page) ? data.page : undefined,
        pace: validPace(data.pace) };
  } catch { /* A damaged checkpoint does not prevent reading. */ }
  if (!source.cloudId) return device;
  const cloud = boundPercent(await getBookProgress(source.cloudId).catch(() => device.percent));
  return cloud === device.percent ? device : { percent: cloud, pace: device.pace };
}

function saveCheckpoint(source: Source, checkpoint: Checkpoint, syncCloud: boolean) {
  const previous = progressWrites.get(source.key) ?? Promise.resolve();
  const write = previous.then(async () => {
    await AsyncStorage.setItem(source.key, JSON.stringify(checkpoint)).catch(() => {});
    if (source.cloudId && syncCloud) await saveBookProgress(source.cloudId, checkpoint.percent).catch(() => {});
  });
  progressWrites.set(source.key, write);
  void write.then(() => {
    if (progressWrites.get(source.key) === write) progressWrites.delete(source.key);
  });
}

export default function Reader() {
  const { id, uri } = useLocalSearchParams<{ id: string; uri?: string }>();
  const [attempt, setAttempt] = useState(0);
  return <ReadingSession key={`${id}:${uri ?? ''}:${attempt}`} id={id} uri={uri} retry={() => setAttempt((value) => value + 1)} />;
}

function ReadingSession({ id, uri, retry }: { id: string; uri?: string; retry: () => void }) {
  const [source, setSource] = useState<Source | null>(null);
  const [recover, setRecover] = useState<LocalBook | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [status, setStatus] = useState('Abrindo a obra…');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<ReadingMode>('page');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [command, setCommand] = useState<{ page: number } | null>(null);
  const [pages, setPages] = useState<ReaderPage[]>([]);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [html, setHtml] = useState('');
  const [epubReady, setEpubReady] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [controls, setControls] = useState(true);
  const [percent, setPercent] = useState(0);
  const checkpoint = useRef<Checkpoint>({ percent: 0 });
  const [pace, setPace] = useState<ReadingPace>({ seconds: 0, fraction: 0 });
  const lastReading = useRef<{ position: number; time: number } | null>(null);
  const epub = useRef<WebView<object>>(null);

  useEffect(() => {
    let active = true;
    const extraction = new AbortController();
    let extracted: Directory | null = null;
    let processing = false;

    void (async () => {
      try {
        let opened: Source;
        if (uri) {
          const book = await findLocalBook(uri);
          if (!book) {
            if (active) setError('Este item saiu da estante. Importe o arquivo novamente.');
            return;
          }
          const file = getLocalFile(book);
          if (!file) {
            if (active) {
              setRecover(book);
              setError('Selecione o arquivo original para recuperar a leitura e salvá-lo no Librio.');
            }
            return;
          }
          opened = { file, format: book.format, title: book.name.replace(/\.[^.]+$/, ''), key: localProgressKey(book), localBook: book };
        } else {
          if (!id || id === 'local') throw new Error('Obra não identificada');
          const { data, error: loadError } = await requireSupabase().from('books').select('*').eq('id', id).single();
          if (loadError) throw loadError;
          const book = data as Book;
          const format = getReadingFormat(book.file_type);
          if (!format) {
            if (active) setError('O leitor aceita arquivos CBR, CBZ, EPUB e PDF.');
            return;
          }
          if (active) setStatus('Baixando da nuvem…');
          const file = await cacheCloudBook(book, format);
          opened = { file, format, title: book.title, key: `librio:cloud-progress:${book.id}`, cloudId: book.id };
        }

        const saved = await readCheckpoint(opened);
        if (!active) return;
        checkpoint.current = saved;
        setPercent(saved.percent);
        if (saved.pace) setPace(saved.pace);
        setPage(saved.page ?? 1);
        if (opened.cloudId) {
          await markBookOpened(opened.cloudId).catch(() => {});
          if (!active) return;
        }
        setSource(opened);
        if (opened.format === 'pdf') {
          setStatus('Renderizando o PDF…');
          return;
        }
        if (opened.format === 'epub') {
          setStatus('Preparando o texto…');
          const content = await readEpubHtml(opened.file.uri, 1, saved.percent, extraction.signal);
          if (active) setHtml(content);
          return;
        }
        setStatus('Organizando as páginas…');
        extracted = new Directory(Paths.cache, 'librio-pages-v2', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        extracted.create({ intermediates: true });
        processing = true;
        try {
          if (opened.format === 'cbr') {
            let found: ReaderPage[] | null = null;
            try {
              found = await extractNativeComic(opened.file, extracted, extraction.signal);
            } catch (error) {
              if (!active) return;
              // Some solid RAR4 archives require the alternate decoder.
              if (!(error instanceof Error) || !/solid/i.test(error.message)) throw error;
            }
            if (active && found) showComic(found, opened.localBook);
            else if (active) {
              const fallback = new Directory(extracted, 'rar-fallback');
              fallback.create();
              setDirectory(fallback);
            }
          } else {
            const found = await readComicZip(opened.file.uri, extracted, extraction.signal);
            if (active) showComic(found, opened.localBook);
          }
        } finally {
          processing = false;
          if (!active && extracted.exists) extracted.delete();
        }
      } catch (cause) {
        if (!active) return;
        console.warn('Librio reader:', cause instanceof Error ? cause.name : 'open failed');
        setError(uri
          ? 'Confira se o arquivo está completo, sem senha e em um formato compatível.'
          : 'Confira sua conexão e tente abrir a obra novamente.');
      }
    })();

    return () => {
      active = false;
      extraction.abort();
      if (!processing && extracted?.exists) extracted.delete();
    };
  }, [id, uri]);

  function showComic(found: ReaderPage[], localBook?: LocalBook) {
    const saved = checkpoint.current;
    setPage(Math.max(1, Math.min(found.length, saved.page ?? Math.round(found.length * saved.percent / 100))));
    setTotal(found.length);
    setPages(found);
    if (localBook && found[0]) void saveAutomaticCover(localBook, new File(found[0].uri)).catch(() => {});
  }

  const persist = useCallback((value: number, current?: number, count = 0) => {
    if (!source || !Number.isFinite(value)) return;
    const normalized = boundPercent(value < 100 ? Math.min(99, value) : 100);
    const position = Math.max(0, Math.min(1, value / 100));
    const time = Date.now();
    const previous = lastReading.current;
    let measured = checkpoint.current.pace;
    if (!previous || previous.position !== position) {
      lastReading.current = { position, time };
      if (previous) {
        const baseline = measured ?? { seconds: 0, fraction: 0 };
        const sample = sampleReadingPace(baseline, previous.position, position, (time - previous.time) / 1000, count);
        if (sample !== baseline) { measured = sample; setPace(sample); }
      }
    }
    if (normalized === checkpoint.current.percent && current === checkpoint.current.page && measured === checkpoint.current.pace) return;
    const syncCloud = normalized !== checkpoint.current.percent;
    checkpoint.current = { percent: normalized, page: current, pace: measured };
    setPercent(normalized);
    saveCheckpoint(source, checkpoint.current, syncCloud);
  }, [source]);

  function onPage(current: number, count: number) {
    if (current < 1 || count < current) return;
    setPage(current);
    setTotal(count);
    persist(current / count * 100, current, count);
  }

  function go(delta: number) {
    const next = Math.min(total, Math.max(1, page + delta));
    if (!total || next === page) return;
    onPage(next, total);
    setCommand({ page: next });
  }

  function tapComic(x: number, width: number) {
    if (mode === 'vertical' || (x >= width * 0.3 && x <= width * 0.7)) {
      setControls((visible) => !visible);
      return;
    }
    go((x > width / 2) === (mode === 'page') ? 1 : -1);
  }

  function onEpubMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') setEpubReady(true);
      if (message.type === 'tap') setControls((value) => !value);
      if (message.type === 'progress' && typeof message.progress === 'number') persist(message.progress);
    } catch { /* Ignore unrelated messages. */ }
  }

  function resizeText(delta: number) {
    const next = Math.max(0.85, Math.min(1.6, fontScale + delta));
    setFontScale(next);
    epub.current?.injectJavaScript(`window.LibrioTextSize?.(${next});true;`);
  }

  async function reconnect() {
    if (!recover || reconnecting) return;
    setReconnecting(true);
    try {
      if (await reconnectLocalBook(recover)) retry();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível recuperar o arquivo.');
    } finally {
      setReconnecting(false);
    }
  }

  function back() {
    if (router.canGoBack()) router.back();
    else router.replace('/library');
  }

  const textMode = source?.format === 'epub';
  const ready = !error && (textMode ? epubReady : total > 0);
  const showControls = controls || !ready;
  const immersive = ready && !showControls;
  const position = textMode ? percent / 100 : page / Math.max(1, total);
  const displayPercent = textMode ? percent : Math.min(page === total ? 100 : 99, Math.round(position * 100));
  const remaining = estimateRemaining(pace, position, textMode ? undefined : Math.max(0, total - page));

  useEffect(() => {
    if (ready && !lastReading.current) lastReading.current = { position, time: Date.now() };
  }, [ready, position]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') lastReading.current = null;
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaView style={s.screen} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar style="light" hidden={immersive} animated />
      <View style={s.canvas}>
        {!error && source?.format === 'pdf' && (
          <PdfReader
            uri={source.file.uri}
            initialProgress={checkpoint.current.percent}
            initialPage={checkpoint.current.page}
            readingMode={mode}
            command={command}
            onPage={onPage}
            onTap={() => setControls((value) => !value)}
            onError={() => setError('O PDF não pôde ser renderizado. Confira se ele está completo e sem senha.')}
          />
        )}
        {!error && pages.length > 0 && (
          <ComicReader pages={pages} page={page} mode={mode} command={command} onPage={(current) => onPage(current, pages.length)} onTap={tapComic} />
        )}
        {!error && source?.format === 'cbr' && directory && !pages.length && (
          <RarExtractor file={source.file} directory={directory} onComplete={(found) => showComic(found, source.localBook)} onStatus={setStatus} onError={setError} />
        )}
        {!error && textMode && !!html && (
          <WebView<object>
            ref={epub}
            source={{ html }}
            style={s.web}
            originWhitelist={['*']}
            allowFileAccess={false}
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={({ url }) => url === 'about:blank' || url.startsWith('about:blank#')}
            onError={() => setError('Não foi possível exibir este EPUB.')}
            onRenderProcessGone={() => setError('O leitor de EPUB foi interrompido. Tente novamente.')}
            onMessage={onEpubMessage}
          />
        )}
        {(!ready || error) && (
          <Animated.View entering={FadeIn.duration(180)} style={s.messageLayer}>
            {error ? (
              <View style={s.message}>
                <BookIcon size={30} />
                <Text accessibilityRole="header" style={s.messageTitle}>Não foi possível abrir</Text>
                <Text style={s.messageCopy}>{error}</Text>
                <Action disabled={reconnecting} title={recover ? 'Selecionar arquivo original' : 'Tentar novamente'} onPress={recover ? () => void reconnect() : retry} />
                <Action title="Voltar" quiet onPress={back} />
              </View>
            ) : (
              <View style={s.message} accessibilityLiveRegion="polite">
                <ActivityIndicator color={palette.violetLight} size="large" />
                <Text style={s.messageCopy}>{status}</Text>
              </View>
            )}
          </Animated.View>
        )}
        {showControls && (
          <Animated.View entering={FadeIn.duration(170)} exiting={FadeOut.duration(140)} style={s.header}>
            <ReaderButton label="Voltar" glyph="‹" onPress={back} />
            <View style={s.titleGroup}>
              <Text style={s.title} numberOfLines={2}>{source?.title ?? recover?.name ?? 'Leitor'}</Text>
              {source && <Text style={s.meta}>{source.format.toUpperCase()} · {uri ? 'Neste dispositivo' : 'Nuvem'}</Text>}
            </View>
            {ready && <ReaderButton label="Ocultar controles" glyph="⛶" onPress={() => setControls(false)} />}
          </Animated.View>
        )}
        {ready && showControls && (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={s.dock}>
            <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: displayPercent }} style={s.track}>
              <View style={[s.fill, { width: `${displayPercent}%` }]} />
            </View>
            <View style={s.stats}>
              <Text style={s.statsPercent}>{displayPercent}% lido</Text>
              <Text style={s.statsTime}>{remaining}</Text>
            </View>
            <View style={s.dockRow}>
              {textMode ? (
                <>
                  <ReaderButton label="Diminuir fonte" glyph="A−" onPress={() => resizeText(-0.1)} disabled={fontScale <= 0.85} />
                  <Text style={s.position}>Tamanho do texto</Text>
                  <ReaderButton label="Aumentar fonte" glyph="A+" onPress={() => resizeText(0.1)} disabled={fontScale >= 1.6} />
                </>
              ) : (
                <>
                  <ReaderButton label="Página anterior" glyph={mode === 'manga' ? '›' : '‹'} onPress={() => go(-1)} disabled={page <= 1} />
                  <Text style={s.position}>{page} / {total}</Text>
                  <ReaderButton label="Próxima página" glyph={mode === 'manga' ? '‹' : '›'} onPress={() => go(1)} disabled={page >= total} />
                </>
              )}
            </View>
            {!textMode && (
              <View style={s.modes}>
                {modes.map(({ value, label }) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: mode === value }}
                    onPress={() => setMode(value)}
                    style={[s.mode, mode === value && s.modeSelected]}
                  >
                    <Text style={[s.modeLabel, mode === value && s.modeLabelSelected]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

function ReaderButton({ label, glyph, onPress, disabled = false }: { label: string; glyph: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.button, (pressed || disabled) && s.buttonDimmed]}
    >
      <Text style={[s.glyph, glyph.length > 1 && s.glyphSmall]}>{glyph}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#100E16' },
  canvas: { flex: 1, position: 'relative' },
  web: { flex: 1, backgroundColor: '#100E16' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    backgroundColor: palette.background, borderBottomWidth: 1, borderBottomColor: palette.border,
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
  },
  titleGroup: { flex: 1 },
  title: { color: palette.text, fontSize: 17, fontWeight: '800' },
  meta: { color: palette.muted, fontSize: 12, marginTop: 3 },
  button: { width: 48, minHeight: 46, borderRadius: 14, backgroundColor: palette.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  buttonDimmed: { opacity: 0.42 },
  glyph: { color: palette.violetLight, fontSize: 29, lineHeight: 34, fontWeight: '600' },
  glyphSmall: { fontSize: 16 },
  dock: {
    position: 'absolute', bottom: 8, zIndex: 2, width: '94%', maxWidth: 460, alignSelf: 'center',
    padding: 10, gap: 8, borderRadius: 20, borderWidth: 1, borderColor: palette.borderLight, backgroundColor: palette.background,
  },
  stats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  statsPercent: { color: palette.violetLight, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statsTime: { color: palette.muted, fontSize: 13 },
  dockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 3, borderRadius: 3, overflow: 'hidden', backgroundColor: palette.surfaceLight },
  fill: { height: '100%', backgroundColor: palette.violet },
  position: { color: palette.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  modes: { flexDirection: 'row', gap: 3, backgroundColor: palette.surface, borderRadius: 12, padding: 3 },
  mode: { flex: 1, minHeight: 44, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  modeSelected: { backgroundColor: palette.violet },
  modeLabel: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  modeLabelSelected: { color: '#181123' },
  messageLayer: { ...StyleSheet.absoluteFill, backgroundColor: '#100E16', alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { gap: 12, width: '100%', maxWidth: 420, alignItems: 'center', paddingVertical: 18 },
  messageTitle: { color: palette.text, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  messageCopy: { color: palette.muted, fontSize: 15, lineHeight: 23, textAlign: 'center' },
});
