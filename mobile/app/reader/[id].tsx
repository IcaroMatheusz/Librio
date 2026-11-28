import { Lucide } from '@react-native-vector-icons/lucide';
import { Directory, File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { libraryInk, themedStyles, useLibraryTheme } from '../../src/design/libraryTheme';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Action, BookIcon } from '../../src/components/atoms';
import ComicReader from '../../src/components/ComicReader';
import PdfReader, { type ReadingMode } from '../../src/components/PdfReader';
import RarExtractor from '../../src/components/RarExtractor';
import { getBookProgress, getBookUrl, markBookOpened, saveBookProgress } from '../../src/lib/library';
import { getLocalFile, localChapters, localProgressKey, readRememberedLocalFiles, reconnectLocalBook } from '../../src/lib/local';
import { extractNativeComic, readComicZip, readEpubHtml, type ReaderPage } from '../../src/lib/reader';
import { requireSupabase } from '../../src/lib/supabase';
import { getReadingFormat, type Book, type LocalBook, type ReadingFormat } from '../../src/lib/types';
import { estimateRemaining, sampleReadingPace, type ReadingPace } from '../../src/lib/readingPace';
import { saveAutomaticCover } from '../../src/lib/localCovers';
import { adjacentChapters, pageStep, positionInChapter, type ChapterDirection, type ChapterEdge } from '../../src/lib/chapterNavigation';
import { boundPercent, cloudProgressKey, readCheckpoint, recordReading, type Checkpoint } from '../../src/lib/readingHistory';
import { IconButton } from '../../src/components/IconButton';
import { useReaderSettings } from '../../src/components/ReaderSettings';
import { LoadingIndicator } from '../../src/components/Loading';
import { PagePicker } from '../../src/components/PagePicker';
import type { RsvpSettings } from '../../src/lib/rsvpSettings';

type Source = { file: File; format: ReadingFormat; title: string; key: string; cloudId?: string; localBook?: LocalBook };
type Target = { id: string; uri?: string; volume?: string };
type Chapters = { previous?: Target; next?: Target; count: number; index: number };
type ReadingControls = {
  mode: ReadingMode;
  setMode: (mode: ReadingMode) => void;
  fontScale: number;
  setFontScale: (value: number) => void;
  controls: boolean;
  setControls: (value: boolean | ((current: boolean) => boolean)) => void;
};
const modes: { value: ReadingMode; label: string }[] = [
  { value: 'page', label: 'Páginas' },
  { value: 'manga', label: 'Mangá' },
  { value: 'vertical', label: 'Rolagem' },
];
const cloudDownloads = new Map<string, Promise<File>>();
const cloudProgressWrites = new Map<string, Promise<void>>();

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

async function loadCheckpoint(source: Source) {
  const device = await readCheckpoint(source.key);
  if (!source.cloudId) return device;
  await cloudProgressWrites.get(source.key);
  const cloud = boundPercent(await getBookProgress(source.cloudId).catch(() => device.percent));
  return cloud === device.percent ? device : { ...device, percent: cloud, page: undefined, epubWord: undefined };
}

function saveCheckpoint(source: Source, checkpoint: Checkpoint, syncCloud: boolean) {
  void recordReading(source.key, checkpoint).catch(() => {});
  const bookId = source.cloudId;
  if (!bookId || !syncCloud) return;
  const write = (cloudProgressWrites.get(source.key) ?? Promise.resolve())
    .then(() => saveBookProgress(bookId, checkpoint.percent).catch(() => {}));
  cloudProgressWrites.set(source.key, write);
  void write.then(() => {
    if (cloudProgressWrites.get(source.key) === write) cloudProgressWrites.delete(source.key);
  });
}

export default function Reader() {
  const { id, uri, volume } = useLocalSearchParams<{ id: string; uri?: string; volume?: string }>();
  return <ReaderSequence key={JSON.stringify([id, uri, volume])} initial={{ id, uri, volume }} />;
}

function ReaderSequence({ initial }: { initial: Target }) {
  const [selection, setSelection] = useState<{ target: Target; edge?: ChapterEdge; revision: number }>({ target: initial, revision: 0 });
  const [mode, setMode] = useState<ReadingMode>('page');
  const [fontScale, setFontScale] = useState(1);
  const [controls, setControls] = useState(true);

  return <ReadingSession key={selection.revision} {...selection.target} edge={selection.edge}
    controls={controls} setControls={setControls} mode={mode} setMode={setMode} fontScale={fontScale} setFontScale={setFontScale}
    retry={() => setSelection((current) => ({ ...current, revision: current.revision + 1 }))}
    openChapter={(target, edge) => setSelection((current) => ({ target, edge, revision: current.revision + 1 }))} />;
}

function ReadingSession({ id, uri, volume, edge, retry, openChapter, mode, setMode, fontScale, setFontScale, controls, setControls }:
  Target & ReadingControls & { edge?: ChapterEdge; retry: () => void; openChapter: (target: Target, edge: ChapterEdge) => void }) {
  const s = useStyles();
  const { mode: appearance, colors } = useLibraryTheme();
  const [source, setSource] = useState<Source | null>(null);
  const [recover, setRecover] = useState<LocalBook | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [status, setStatus] = useState('Abrindo a obra…');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [command, setCommand] = useState<{ page: number } | null>(null);
  const [pages, setPages] = useState<ReaderPage[]>([]);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [html, setHtml] = useState('');
  const [epubReady, setEpubReady] = useState(false);
  const [rsvpActive, setRsvpActive] = useState(false);
  const { enabled: fade, open: openPreferences, rsvp, setRsvp } = useReaderSettings();
  const initialFont = useRef(fontScale).current;
  const [percent, setPercent] = useState(0);
  const [epubStats, setEpubStats] = useState({ words: 0, screens: 1, screen: 1 });
  const [chapters, setChapters] = useState<Chapters>({ index: -1, count: 0 });
  const moving = useRef(false);
  const displayedPage = useRef<number | null>(null);
  const checkpoint = useRef<Checkpoint>({ percent: 0 });
  const [pace, setPace] = useState<ReadingPace>({ seconds: 0, fraction: 0 });
  const lastReading = useRef<{ position: number; time: number } | null>(null);
  const epub = useRef<WebView<object>>(null);
  const epubTheme = `document.documentElement.dataset.theme = ${JSON.stringify(appearance)};true;`;
  useEffect(() => {
    if (epubReady) epub.current?.injectJavaScript(epubTheme);
  }, [epubReady, epubTheme]);
  const epubSource = useMemo(() => ({ html }), [html]);
  const rsvpRunning = useRef(false);

  useEffect(() => {
    let active = true;
    const extraction = new AbortController();
    let extracted: Directory | null = null;
    let processing = false;

    void (async () => {
      try {
        let opened: Source;
        if (uri) {
          const books = await readRememberedLocalFiles();
          const book = books.find((entry) => entry.uri === uri || entry.sourceUri === uri);
          if (!book) {
            if (active) setError('Este item saiu da estante. Importe o arquivo novamente.');
            return;
          }
          const neighbors = localChapters(books, book);
          if (active) setChapters({
            index: neighbors.index, count: neighbors.count,
            previous: neighbors.previous && { id: 'local', uri: neighbors.previous.uri },
            next: neighbors.next && { id: 'local', uri: neighbors.next.uri },
          });
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
          opened = { file, format, title: book.title, key: cloudProgressKey(book.id), cloudId: book.id };
        }

        if (volume && opened.cloudId) {
          const { data } = await requireSupabase().from('volume_chapters').select('book_id')
            .eq('volume_id', volume).order('chapter_number');
          const ordered = data?.map(({ book_id }) => book_id) ?? [];
          const neighbors = adjacentChapters(ordered, opened.cloudId);
          if (active && neighbors.index >= 0) setChapters({
            index: neighbors.index, count: neighbors.count,
            previous: neighbors.previous && { id: neighbors.previous, volume },
            next: neighbors.next && { id: neighbors.next, volume },
          });
        }

        const saved = await loadCheckpoint(opened);
        if (!active) return;
        checkpoint.current = saved;
        setPercent(edge === 'start' ? 0 : edge === 'end' ? 100 : saved.percent);
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
          const start = edge === 'start' ? 0 : edge === 'end' ? 100 : saved.percent;
          const content = await readEpubHtml(opened.file.uri, initialFont, start, extraction.signal, edge ? undefined : saved.epubWord);
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
  }, [id, uri, volume, edge, initialFont]);

  function showComic(found: ReaderPage[], localBook?: LocalBook) {
    const saved = checkpoint.current;
    const start = positionInChapter(found.length, saved.page, saved.percent, edge);
    displayedPage.current = start;
    setPage(start);
    setTotal(found.length);
    setPages(found);
    if (localBook && found[0]) void saveAutomaticCover(localBook, new File(found[0].uri)).catch(() => {});
  }

  const persist = useCallback((value: number, current?: number, count = 0, word?: number) => {
    if (!source || moving.current || !Number.isFinite(value)) return;
    const normalized = boundPercent(value < 100 ? Math.min(99, value) : 100);
    const position = Math.max(0, Math.min(1, value / 100));
    const time = Date.now();
    const previous = lastReading.current;
    let measured = checkpoint.current.pace;
    if (rsvpRunning.current) lastReading.current = null;
    else if (!previous || previous.position !== position) {
      lastReading.current = { position, time };
      if (previous) {
        const baseline = measured ?? { seconds: 0, fraction: 0 };
        const sample = sampleReadingPace(baseline, previous.position, position, (time - previous.time) / 1000, count);
        if (sample !== baseline) { measured = sample; setPace(sample); }
      }
    }
    if (normalized === checkpoint.current.percent && current === checkpoint.current.page && word === checkpoint.current.epubWord
      && measured === checkpoint.current.pace) return;
    const syncCloud = normalized !== checkpoint.current.percent;
    checkpoint.current = { percent: normalized, page: current, epubWord: word, pace: measured, lastReadAt: Date.now(), volumeId: volume };
    setPercent(position * 100);
    saveCheckpoint(source, checkpoint.current, syncCloud);
  }, [source, volume]);

  function onPage(current: number, count: number) {
    if (moving.current || current < 1 || count < current) return;
    const changed = displayedPage.current !== null && displayedPage.current !== current;
    displayedPage.current = current;
    setPage(current);
    setTotal(count);
    if (changed) persist(current / count * 100, current, count);
  }

  function crossChapter(direction: ChapterDirection) {
    const target = direction === -1 ? chapters.previous : chapters.next;
    if (!target || moving.current) return;
    if (direction === 1) persist(100, textMode ? undefined : total, total);
    moving.current = true;
    openChapter(target, direction === 1 ? 'start' : 'end');
  }

  function go(direction: ChapterDirection) {
    if (!total || moving.current) return;
    const next = pageStep(page, total, direction);
    if (next === undefined) {
      crossChapter(direction);
      return;
    }
    showPage(next);
  }

  function showPage(next: number) {
    onPage(next, total);
    setCommand({ page: next });
  }

  function jumpToPage(next: number) {
    lastReading.current = null;
    if (textMode) epub.current?.injectJavaScript(`window.LibrioJumpToScreen?.(${next});true;`);
    else showPage(next);
  }

  function tapPage(x: number, width: number) {
    if (width <= 0 || mode === 'vertical' || (x >= width * 0.3 && x <= width * 0.7)) {
      setControls((visible) => !visible);
      return;
    }
    go((x > width / 2) === (mode === 'page') ? 1 : -1);
  }

  function onEpubMessage(event: WebViewMessageEvent) {
    if (moving.current) return;
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'tap') setControls((value) => !value);
      if (message.type === 'boundary' && (message.direction === -1 || message.direction === 1)) crossChapter(message.direction);
      if (message.type === 'rsvp-settings') setRsvp(message as Partial<RsvpSettings>);
      if (message.type === 'rsvp-mode') {
        rsvpRunning.current = message.active === true;
        setRsvpActive(rsvpRunning.current);
        lastReading.current = null;
      }
      if ((message.type === 'ready' || message.type === 'progress') && Number.isFinite(message.progress)
        && Number.isSafeInteger(message.screens) && message.screens > 0
        && Number.isSafeInteger(message.screen) && message.screen > 0 && message.screen <= message.screens
        && Number.isSafeInteger(message.words) && message.words >= 0) {
        setEpubStats((current) => current.screens === message.screens && current.screen === message.screen && current.words === message.words
          ? current : { words: message.words, screens: message.screens, screen: message.screen });
        const progress = Math.min(100, Math.max(0, message.progress));
        setPercent(progress);
        const word = Number.isSafeInteger(message.word) && message.word >= 0 && message.word < message.words ? message.word : undefined;
        if (message.type === 'ready') setEpubReady(true);
        else persist(progress, undefined, 0, word);
      }
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
  const showControls = !rsvpActive && (controls || !ready);
  const immersive = ready && !showControls;
  const position = textMode ? percent / 100 : page / Math.max(1, total);
  const displayPercent = Math.min(position >= 1 ? 100 : 99, Math.round(position * 100));
  const estimate = estimateRemaining(pace, position, source?.format ?? '', total, epubStats.words, epubStats.screens);
  const canGoBack = page > 1 || !!chapters.previous;
  const canGoNext = page < total || !!chapters.next;
  const chapterBefore = textMode ? percent <= 1 && !!chapters.previous : page <= 1;
  const chapterAfter = textMode ? (percent >= 99 || epubStats.screens === 1) && !!chapters.next : page >= total;
  const presentedOnce = useRef(false);

  useEffect(() => {
    if (!ready || !source || presentedOnce.current) return;
    presentedOnce.current = true;
    const saved = checkpoint.current;
    const firstPosition = edge !== 'end' && (saved.percent === 0 || edge === 'start');
    const opening = { ...saved, hidden: false, lastReadAt: Date.now(), volumeId: volume ?? saved.volumeId,
      ...(firstPosition ? { percent: displayPercent, page: textMode ? undefined : page, epubWord: edge === 'start' ? undefined : saved.epubWord } : {}) };
    checkpoint.current = opening;
    saveCheckpoint(source, opening, firstPosition && opening.percent !== saved.percent);
  }, [source, ready, displayPercent, page, textMode, edge, volume]);

  useEffect(() => {
    if (ready && !rsvpActive && !lastReading.current) lastReading.current = { position, time: Date.now() };
  }, [ready, position, rsvpActive]);

  useEffect(() => {
    if (epubReady) epub.current?.injectJavaScript(`window.LibrioRsvpSettings?.(${JSON.stringify(rsvp)});true;`);
  }, [epubReady, rsvp]);

  useEffect(() => {
    if (!rsvpActive) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      epub.current?.injectJavaScript('window.LibrioRsvpClose?.();true;');
      return true;
    });
    return () => subscription.remove();
  }, [rsvpActive]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        lastReading.current = null;
        if (rsvpRunning.current) epub.current?.injectJavaScript('window.LibrioRsvpPause?.();true;');
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaView style={s.screen} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar style={appearance === 'dark' ? 'light' : 'dark'} hidden={immersive} />
      <View style={s.canvas}>
        {!error && source?.format === 'pdf' && (
          <PdfReader
            uri={source.file.uri}
            initialProgress={edge === 'start' ? 0 : edge === 'end' ? 100 : checkpoint.current.percent}
            initialPage={displayedPage.current ?? (edge ? undefined : checkpoint.current.page)}
            fade={fade}
            readingMode={mode}
            command={command}
            onPage={onPage}
            onTap={tapPage}
            onError={() => setError('O PDF não pôde ser renderizado. Confira se ele está completo e sem senha.')}
          />
        )}
        {!error && pages.length > 0 && (
          <ComicReader pages={pages} page={page} mode={mode} command={command} fade={fade} hasPrevious={!!chapters.previous} hasNext={!!chapters.next}
            onPage={(current) => onPage(current, pages.length)} onTap={tapPage} onChapter={crossChapter} />
        )}
        {!error && source?.format === 'cbr' && directory && !pages.length && (
          <RarExtractor file={source.file} directory={directory} onComplete={(found) => showComic(found, source.localBook)} onStatus={setStatus} onError={setError} />
        )}
        {!error && textMode && !!html && (
          <Animated.View entering={fade ? FadeIn.duration(180) : undefined} style={s.web}>
          <WebView<object>
            ref={epub}
            source={epubSource}
            injectedJavaScriptBeforeContentLoaded={epubTheme}
            onLoadEnd={() => epub.current?.injectJavaScript(epubTheme)}
            style={s.web}
            originWhitelist={['*']}
            allowFileAccess={false}
            setBuiltInZoomControls
            setSupportMultipleWindows={false}
            onShouldStartLoadWithRequest={({ url }) => url === 'about:blank' || url.startsWith('about:blank#')}
            onError={() => setError('Não foi possível exibir este EPUB.')}
            onRenderProcessGone={() => setError('O leitor de EPUB foi interrompido. Tente novamente.')}
            onMessage={onEpubMessage}
          />
          </Animated.View>
        )}
        {(!ready || error) && (
          <Animated.View entering={fade ? FadeIn.duration(180) : undefined} style={s.messageLayer}>
            {error ? (
              <View style={s.message}>
                <BookIcon size={30} />
                <Text accessibilityRole="header" style={s.messageTitle}>Não foi possível abrir</Text>
                <Text style={s.messageCopy}>{error}</Text>
                <Action disabled={reconnecting} title={recover ? 'Selecionar arquivo original' : 'Tentar novamente'} onPress={recover ? () => void reconnect() : retry} />
                <Action title="Voltar" quiet onPress={back} />
              </View>
            ) : (
              <LoadingIndicator label={status} />
            )}
          </Animated.View>
        )}
        {showControls && (
          <Animated.View entering={fade ? FadeIn.duration(170) : undefined} exiting={fade ? FadeOut.duration(140) : undefined} style={s.header}>
            <IconButton icon="arrow-left" label="Voltar à estante" onPress={back} />
            <View style={s.titleGroup}>
              <Text style={s.title} numberOfLines={2}>{source?.title ?? recover?.name ?? 'Leitor'}</Text>
              {source && (
                <Text numberOfLines={1} style={s.meta}>
                  {source.format.toUpperCase()} · {chapters.count > 1 ? `Capítulo ${chapters.index + 1} de ${chapters.count}` : uri ? 'No aparelho' : 'Nuvem'}
                </Text>
              )}
            </View>
            <IconButton icon="settings-2" label="Preferências de leitura" onPress={openPreferences} />
            {ready && <IconButton icon="maximize" label="Ocultar controles" onPress={() => setControls(false)} />}
          </Animated.View>
        )}
        {ready && showControls && (
          <Animated.View entering={fade ? FadeIn.duration(180) : undefined} exiting={fade ? FadeOut.duration(140) : undefined} style={s.dock}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.dockContent}>
            <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: displayPercent }} style={s.track}>
              <View style={[s.fill, { width: `${displayPercent}%` }]} />
            </View>
            <View style={s.stats}>
              <View style={s.stat}>
                <Lucide name="book-open" color={colors.accent} size={15} accessible={false} />
                <Text style={s.statsPercent}>{displayPercent}% lido</Text>
              </View>
              <View style={s.stat}>
                <Lucide name="clock-3" color={colors.accent} size={15} accessible={false} />
                <View>
                  <Text style={s.statsTime}>{estimate.time}</Text>
                  {!!estimate.basis && <Text style={s.estimateBasis}>{estimate.basis}</Text>}
                </View>
              </View>
            </View>
            <View style={s.dockRow}>
              {textMode ? (
                <>
                  <IconButton icon="minus" label="Diminuir fonte" onPress={() => resizeText(-0.1)} disabled={fontScale <= 0.85} />
                  <PagePicker page={epubStats.screen} total={epubStats.screens} screen onSelect={jumpToPage} />
                  <IconButton icon="plus" label="Aumentar fonte" onPress={() => resizeText(0.1)} disabled={fontScale >= 1.6} />
                </>
              ) : (
                <>
                  <IconButton label={chapterBefore && canGoBack ? 'Capítulo anterior' : 'Página anterior'}
                    icon={chapterBefore && canGoBack ? 'list-start' : mode === 'manga' ? 'chevron-right' : 'chevron-left'}
                    onPress={() => go(-1)} disabled={!canGoBack} />
                  <PagePicker page={page} total={total} onSelect={jumpToPage} />
                  <IconButton label={chapterAfter && canGoNext ? 'Próximo capítulo' : 'Próxima página'}
                    icon={chapterAfter && canGoNext ? 'list-end' : mode === 'manga' ? 'chevron-left' : 'chevron-right'}
                    onPress={() => go(1)} disabled={!canGoNext} />
                </>
              )}
            </View>
            {textMode && epubStats.words > 0 && (
              <Action quiet title="Leitura rápida (RSVP)" onPress={() => epub.current?.injectJavaScript('window.LibrioRsvpOpen?.();true;')} />
            )}
            {textMode && (chapterBefore || chapterAfter) && (
              <View style={s.chapterActions}>
                {chapterBefore && <Action title="Capítulo anterior" quiet onPress={() => crossChapter(-1)} />}
                {chapterAfter && <Action title="Próximo capítulo" onPress={() => crossChapter(1)} />}
              </View>
            )}
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
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  canvas: { flex: 1, position: 'relative', backgroundColor: libraryInk.canvas },
  web: { flex: 1, backgroundColor: colors.background },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10,
  },
  titleGroup: { flex: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  dock: {
    position: 'absolute', bottom: 8, zIndex: 2, width: '94%', maxWidth: 460, alignSelf: 'center',
    maxHeight: '72%', overflow: 'hidden', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.raised,
  },
  dockContent: { padding: 10, gap: 8 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  statsPercent: { color: colors.accent, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statsTime: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
  estimateBasis: { color: colors.muted, fontSize: 10, marginTop: 2 },
  chapterActions: { flexDirection: 'row', justifyContent: 'space-around', gap: 8, flexWrap: 'wrap' },
  dockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 3, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.track },
  fill: { height: '100%', backgroundColor: colors.accent },
  modes: { flexDirection: 'row', gap: 3, backgroundColor: colors.surface, borderRadius: 12, padding: 3 },
  mode: { flex: 1, minHeight: 44, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  modeSelected: { backgroundColor: colors.accentSoft },
  modeLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  modeLabelSelected: { color: colors.accent },
  messageLayer: { ...StyleSheet.absoluteFill, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { gap: 12, width: '100%', maxWidth: 420, alignItems: 'center', paddingVertical: 18 },
  messageTitle: { color: colors.text, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  messageCopy: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center' },
}));
