import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import PdfReader, { type ReadingMode } from '../../src/components/PdfReader';
import { BookIcon, palette } from '../../src/components/atoms';
import { getBookProgress, getBookUrl, markBookOpened, saveBookProgress } from '../../src/lib/library';
import { bytesToBase64, readComicZip, readEpubHtml, type ReaderPage } from '../../src/lib/reader';
import { requireSupabase } from '../../src/lib/supabase';
import type { Book } from '../../src/lib/types';

type ReaderFile = { file: File; format: string; title: string; cloudBookId?: string };
type ReaderEvent = { type?: string; message?: string; current?: number; total?: number; progress?: number };

const LOCAL_PROGRESS_PREFIX = 'librio:reader-progress:';
const RAR_BUNDLE = require('../../assets/rar-reader.txt');
const MAX_CBR_BRIDGE_BYTES = 120 * 1024 * 1024;

export default function Reader() {
  const params = useLocalSearchParams<{ id?: string; uri?: string; title?: string; format?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const uri = Array.isArray(params.uri) ? params.uri[0] : params.uri;
  const localTitle = Array.isArray(params.title) ? params.title[0] : params.title;
  const localFormat = Array.isArray(params.format) ? params.format[0] : params.format;

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isTablet = windowWidth >= 768;

  const [readingFile, setReadingFile] = useState<ReaderFile | null>(null);
  const [pages, setPages] = useState<ReaderPage[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const [readingMode, setReadingMode] = useState<ReadingMode>('page');
  const [showControls, setShowControls] = useState(true);
  const [epubHtml, setEpubHtml] = useState('');
  const [rarHtml, setRarHtml] = useState('');
  const [rarLoading, setRarLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [rarReady, setRarReady] = useState(false);
  const [rarStarted, setRarStarted] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Preparando sua leitura…');

  const webView = useRef<WebView>(null);
  const progressRef = useRef(0);
  const verticalListRef = useRef<FlatList<ReaderPage>>(null);
  const format = readingFile?.format.toLowerCase() ?? '';
  const localProgressKey = useMemo(() => (uri ? `${LOCAL_PROGRESS_PREFIX}${uri}` : ''), [uri]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setReadingFile(null);
    setPages([]);
    setPage(1);
    setPageCount(0);
    setEpubHtml('');
    setRarHtml('');
    setRarReady(false);
    setRarStarted(false);
    setProgress(0);
    progressRef.current = 0;

    void (async () => {
      try {
        if (uri) {
          const file = new File(uri);
          const detected = (localFormat || file.name.split('.').pop() || '').toLowerCase();
          if (!['pdf', 'epub', 'cbz', 'cbr'].includes(detected)) {
            throw new Error('Este formato ainda não pode ser lido pelo Librio.');
          }
          if (localProgressKey) {
            const saved = Number((await AsyncStorage.getItem(localProgressKey)) ?? 0);
            if (active && Number.isFinite(saved)) {
              setProgress(saved);
              progressRef.current = saved;
            }
          }
          if (active) {
            setReadingFile({
              file,
              format: detected,
              title: localTitle || file.name.replace(/\.[^.]+$/, ''),
            });
          }
        } else if (id && id !== 'local') {
          const client = requireSupabase();
          const { data, error: bookError } = await client
            .from('books')
            .select('*')
            .eq('id', id)
            .single();
          if (bookError) throw bookError;
          const book = data as Book;
          const detected = book.file_type.toLowerCase();
          if (!['pdf', 'epub', 'cbz', 'cbr'].includes(detected)) {
            throw new Error('Este formato ainda não pode ser lido pelo Librio.');
          }
          const folder = new Directory(Paths.cache, 'librio-reader');
          if (!folder.exists) folder.create({ intermediates: true });
          const cached = new File(folder, `${book.id}.${detected}`);
          const saved = await getBookProgress(book.id);
          if (!cached.exists) {
            setLoadingMessage('Baixando obra da nuvem…');
            const signedUrl = await getBookUrl(book);
            await File.downloadFileAsync(signedUrl, cached, { idempotent: true });
          }
          await markBookOpened(book.id);
          if (active) {
            setProgress(saved);
            progressRef.current = saved;
            setReadingFile({
              file: cached,
              format: detected,
              title: book.title,
              cloudBookId: book.id,
            });
          }
        } else {
          throw new Error('Não foi possível identificar a obra para leitura.');
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Não foi possível abrir esta obra.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id, uri, localTitle, localFormat, localProgressKey]);

  useEffect(() => {
    if (!readingFile || !['cbz', 'epub', 'cbr'].includes(format)) return;
    let active = true;

    void (async () => {
      try {
        if (format === 'cbz') {
          setLoadingMessage('Organizando as páginas…');
          const found = await readComicZip(readingFile.file.uri);
          if (!active) return;
          setPages(found);
          setPageCount(found.length);
          const initial = Math.max(
            1,
            Math.min(
              found.length,
              Math.ceil((progressRef.current / 100) * found.length) || 1
            )
          );
          setPage(initial);
        } else if (format === 'epub') {
          setLoadingMessage('Preparando o livro…');
          const html = await readEpubHtml(
            readingFile.file.uri,
            fontScale,
            progressRef.current,
            readingMode
          );
          if (active) setEpubHtml(html);
        } else {
          setLoadingMessage('Preparando o leitor de quadrinhos CBR…');
          const asset = Asset.fromModule(RAR_BUNDLE);
          await asset.downloadAsync();
          if (!asset.localUri) {
            throw new Error('O leitor CBR não está disponível neste APK.');
          }
          const bundle = await new File(asset.localUri).text();
          if (!active) return;
          setRarHtml(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><meta charset="utf-8"><style>
            html,body{margin:0;background:#171A27;color:#e7e2f1;font:16px system-ui;-webkit-user-select:none;user-select:none}
            #pages{max-width:960px;margin:0 auto;padding:0 8px 50px}
            .page{display:block;width:100%;height:auto;max-height:94vh;object-fit:contain;margin:0 auto 12px;border-radius:4px}
            #status{position:fixed;inset:0;display:grid;place-items:center;background:#171A27;color:#c4b5fd;font-weight:700}
          </style></head><body><div id="status">Preparando o leitor CBR…</div><main id="pages"></main><script>${bundle}</script></body></html>`);
          setRarLoading(true);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Não foi possível preparar este arquivo.'
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [readingFile, format, fontScale, readingMode]);

  const persistProgress = useCallback(
    (value: number) => {
      const normalized = Math.max(0, Math.min(100, Math.round(value)));
      if (Math.abs(normalized - progressRef.current) < 1) return;
      progressRef.current = normalized;
      setProgress(normalized);
      if (readingFile?.cloudBookId) {
        void saveBookProgress(readingFile.cloudBookId, normalized).catch(() => {});
      } else if (localProgressKey) {
        void AsyncStorage.setItem(localProgressKey, String(normalized)).catch(() => {});
      }
    },
    [readingFile, localProgressKey]
  );

  const onRarMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      let message: ReaderEvent;
      try {
        message = JSON.parse(event.nativeEvent.data) as ReaderEvent;
      } catch {
        return;
      }
      if (message.type === 'ready-for-file' && !rarStarted && readingFile) {
        setRarStarted(true);
        void (async () => {
          try {
            if (readingFile.file.size > MAX_CBR_BRIDGE_BYTES) {
              throw new Error(
                'Este CBR é grande demais para abrir no leitor local (limite de 120 MB).'
              );
            }
            const data = bytesToBase64(new Uint8Array(await readingFile.file.arrayBuffer()));
            webView.current?.injectJavaScript(`window.LibrioRarReader.open('${data}'); true;`);
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : 'Não foi possível ler este arquivo CBR.'
            );
          }
        })();
      } else if (message.type === 'count' || message.type === 'ready') {
        setRarLoading(false);
        if (message.total) {
          setPageCount(message.total);
          setPage(
            Math.max(
              1,
              Math.ceil((progressRef.current / 100) * message.total) || 1
            )
          );
        }
      } else if (message.type === 'loading') {
        setLoadingMessage(message.message || 'Organizando as páginas…');
        setRarLoading(true);
      } else if (message.type === 'page') {
        if (message.current) setPage(message.current);
        if (message.total) setPageCount(message.total);
        if (message.current && message.total) {
          persistProgress((message.current / message.total) * 100);
        }
      } else if (message.type === 'progress') {
        setLoadingMessage('Carregando as páginas…');
      } else if (message.type === 'error') {
        setRarLoading(false);
        setError(message.message || 'Não foi possível abrir este arquivo CBR.');
      }
    },
    [rarStarted, readingFile, persistProgress]
  );

  function movePage(delta: number) {
    const next = Math.max(1, Math.min(pageCount, page + delta));
    if (next === page) return;
    setPage(next);
    if (format === 'cbz') {
      persistProgress(pageCount ? (next / pageCount) * 100 : 0);
      if (readingMode === 'vertical' && verticalListRef.current) {
        try {
          verticalListRef.current.scrollToIndex({ index: next - 1, animated: true });
        } catch {
          // ignore layout bounds
        }
      }
    }
    if (format === 'cbr') {
      webView.current?.injectJavaScript(
        `document.querySelector('[data-page="${next}"]')?.scrollIntoView({behavior:'smooth',block:'start'}); true;`
      );
    }
  }

  // Handle tap navigation depending on mode
  function handleCanvasTap(tapX: number) {
    // If tap is in center 40% of screen: toggle HUD
    const leftMargin = windowWidth * 0.3;
    const rightMargin = windowWidth * 0.7;

    if (tapX >= leftMargin && tapX <= rightMargin) {
      setShowControls((prev) => !prev);
      return;
    }

    if (readingMode === 'vertical') {
      // In vertical mode, just toggle HUD
      setShowControls((prev) => !prev);
      return;
    }

    if (readingMode === 'manga') {
      // Manga mode: tap left advances (+1), tap right goes back (-1)
      if (tapX < leftMargin) {
        movePage(1);
      } else {
        movePage(-1);
      }
    } else {
      // Standard LTR page mode: tap right advances (+1), tap left goes back (-1)
      if (tapX > rightMargin) {
        movePage(1);
      } else {
        movePage(-1);
      }
    }
  }

  function onWebMessage(event: { nativeEvent: { data: string } }) {
    if (format === 'cbr') {
      onRarMessage(event);
      return;
    }
    try {
      const message = JSON.parse(event.nativeEvent.data) as ReaderEvent;
      if (message.type === 'progress' && typeof message.progress === 'number') {
        persistProgress(message.progress);
      }
    } catch {
      // Ignore other events
    }
  }

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
      if (viewableItems.length > 0 && typeof viewableItems[0].index === 'number') {
        const curr = viewableItems[0].index + 1;
        setPage(curr);
        if (pageCount > 0) {
          persistProgress((curr / pageCount) * 100);
        }
      }
    }
  ).current;

  function dismissError() {
    setError('');
    router.back();
  }

  return (
    <View style={s.screen}>
      {/* Top HUD Header */}
      {showControls && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backButton}>
            <Text style={s.back}>‹</Text>
          </Pressable>

          <View style={s.brandMark}>
            <BookIcon size={16} color={palette.violetLight} />
          </View>

          <View style={s.heading}>
            <Text style={s.title} numberOfLines={1}>
              {readingFile?.title ?? 'Leitor'}
            </Text>
            <View style={s.metaRow}>
              <Text style={s.metaFormat}>{(format || 'DOC').toUpperCase()}</Text>
              <Text style={s.metaDot}>•</Text>
              <Text style={s.metaSource}>
                {uri ? 'NESTE DISPOSITIVO' : 'NUVEM'}
              </Text>
            </View>
          </View>

          {/* Mode Selector HUD Pills */}
          <View style={s.modeSelector}>
            <Pressable
              onPress={() => setReadingMode('page')}
              style={[s.modeBtn, readingMode === 'page' && s.modeBtnActive]}
            >
              <Text
                style={[
                  s.modeBtnText,
                  readingMode === 'page' && s.modeBtnTextActive,
                ]}
              >
                Páginas
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setReadingMode('manga')}
              style={[s.modeBtn, readingMode === 'manga' && s.modeBtnActive]}
            >
              <Text
                style={[
                  s.modeBtnText,
                  readingMode === 'manga' && s.modeBtnTextActive,
                ]}
              >
                Mangá (RTL)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setReadingMode('vertical')}
              style={[s.modeBtn, readingMode === 'vertical' && s.modeBtnActive]}
            >
              <Text
                style={[
                  s.modeBtnText,
                  readingMode === 'vertical' && s.modeBtnTextActive,
                ]}
              >
                Rolagem
              </Text>
            </Pressable>
          </View>

          {/* EPUB font controls */}
          {format === 'epub' && (
            <View style={s.fontControls}>
              <Pressable
                style={s.fontButton}
                onPress={() => setFontScale((v) => Math.max(0.85, v - 0.1))}
              >
                <Text style={s.fontButtonText}>A−</Text>
              </Pressable>
              <Pressable
                style={s.fontButton}
                onPress={() => setFontScale((v) => Math.min(1.6, v + 0.1))}
              >
                <Text style={s.fontButtonText}>A+</Text>
              </Pressable>
            </View>
          )}

          {pageCount > 0 && format !== 'epub' && (
            <View style={s.pageBadge}>
              <Text style={s.pageCounter}>
                {page} / {pageCount}
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Main Canvas Area */}
      <View style={s.canvas}>
        {loading ? (
          <Animated.View entering={FadeIn} style={s.center}>
            <ActivityIndicator size="large" color={palette.violet} />
            <Text style={s.loading}>{loadingMessage}</Text>
          </Animated.View>
        ) : error ? (
          <Animated.View entering={FadeInDown} style={s.center}>
            <View style={s.errorIcon}>
              <Text style={s.errorSymbol}>!</Text>
            </View>
            <Text style={s.errorTitle}>Não foi possível abrir</Text>
            <Text style={s.errorCopy}>{error}</Text>
            <Pressable style={s.retryButton} onPress={dismissError}>
              <Text style={s.retryText}>Voltar à biblioteca</Text>
            </Pressable>
          </Animated.View>
        ) : !readingFile ? null : format === 'pdf' ? (
          <Pressable
            style={s.flex1}
            onPress={(e) => handleCanvasTap(e.nativeEvent.locationX)}
          >
            <PdfReader
              uri={readingFile.file.uri}
              initialProgress={progress}
              readingMode={readingMode}
              targetPage={page}
              onProgress={persistProgress}
              onPage={(current, total) => {
                setPage(current);
                setPageCount(total);
              }}
              onError={setError}
            />
          </Pressable>
        ) : format === 'cbz' ? (
          readingMode === 'vertical' ? (
            <FlatList
              ref={verticalListRef}
              data={pages}
              keyExtractor={(item) => item.uri}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
              contentContainerStyle={s.verticalContent}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => setShowControls((prev) => !prev)}
                  style={s.verticalPageWrap}
                >
                  <Image
                    source={{ uri: item.uri }}
                    resizeMode="contain"
                    style={{
                      width: Math.min(windowWidth - (isTablet ? 64 : 16), 960),
                      height: windowHeight * 0.9,
                    }}
                  />
                  <Text style={s.verticalPageNumber}>
                    {index + 1} / {pages.length}
                  </Text>
                </Pressable>
              )}
            />
          ) : (
            <Pressable
              style={s.comicReader}
              onPress={(e) => handleCanvasTap(e.nativeEvent.locationX)}
            >
              <View style={s.pageCanvas}>
                {pages[page - 1] ? (
                  <Animated.View
                    key={`${page}-${readingMode}`}
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(80)}
                    style={s.comicPage}
                  >
                    <Image
                      source={{ uri: pages[page - 1].uri }}
                      resizeMode="contain"
                      style={{
                        width: Math.min(windowWidth - (isTablet ? 48 : 20), 1100),
                        height: '100%',
                      }}
                    />
                  </Animated.View>
                ) : (
                  <View style={s.center}>
                    <ActivityIndicator size="large" color={palette.violet} />
                    <Text style={s.loading}>{error || loadingMessage}</Text>
                  </View>
                )}
              </View>

              {/* Tap zone cues in Manga vs Page mode */}
              <View pointerEvents="none" style={s.tapCues}>
                <View style={s.tapCueSide}>
                  <Text style={s.tapCueText}>
                    {readingMode === 'manga' ? '← Próxima' : '‹ Anterior'}
                  </Text>
                </View>
                <View style={s.tapCueSide}>
                  <Text style={s.tapCueText}>
                    {readingMode === 'manga' ? 'Anterior →' : 'Próxima ›'}
                  </Text>
                </View>
              </View>
            </Pressable>
          )
        ) : format === 'epub' ? (
          epubHtml ? (
            <Pressable
              style={s.flex1}
              onPress={() => setShowControls((prev) => !prev)}
            >
              <WebView
                source={{ html: epubHtml, baseUrl: 'https://librio.local/' }}
                style={s.web}
                originWhitelist={['*']}
                onMessage={onWebMessage}
                startInLoadingState
                renderLoading={() => (
                  <ActivityIndicator
                    style={s.webLoader}
                    size="large"
                    color={palette.violet}
                  />
                )}
              />
            </Pressable>
          ) : (
            <View style={s.center}>
              <ActivityIndicator size="large" color={palette.violet} />
              <Text style={s.loading}>{loadingMessage}</Text>
            </View>
          )
        ) : format === 'cbr' ? (
          rarHtml ? (
            <View style={s.webWrap}>
              <WebView
                ref={webView as any}
                source={{ html: rarHtml, baseUrl: 'https://librio.local/' }}
                style={s.web}
                originWhitelist={['*']}
                onMessage={onWebMessage}
                onLoadEnd={() => setRarReady(true)}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                renderLoading={() => (
                  <ActivityIndicator
                    style={s.webLoader}
                    size="large"
                    color={palette.violet}
                  />
                )}
              />
              <View pointerEvents="none" style={s.rarStatus}>
                <Text style={s.rarStatusText}>
                  {rarLoading && loadingMessage}
                </Text>
              </View>
              {!rarReady && (
                <View style={s.webShield}>
                  <ActivityIndicator size="large" color={palette.violet} />
                  <Text style={s.loading}>Preparando o leitor CBR…</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={s.center}>
              <ActivityIndicator size="large" color={palette.violet} />
              <Text style={s.loading}>{loadingMessage}</Text>
            </View>
          )
        ) : null}
      </View>

      {/* Bottom Controls HUD */}
      {showControls && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
          {/* CBZ & CBR bottom controls */}
          {(format === 'cbz' || format === 'cbr') && pageCount > 0 && (
            <View style={s.readerControls}>
              {readingMode === 'manga' ? (
                <>
                  <Pressable
                    disabled={page >= pageCount}
                    onPress={() => movePage(1)}
                    style={[
                      s.pageButton,
                      s.nextButton,
                      page >= pageCount && s.pageButtonDisabled,
                    ]}
                  >
                    <Text style={s.nextButtonText}>← Próxima</Text>
                  </Pressable>

                  <View style={s.pageCenterInfo}>
                    <Text style={s.pageHint}>
                      {page} de {pageCount}
                    </Text>
                    <Text style={s.modeHintBadge}>MANGÁ (RTL)</Text>
                  </View>

                  <Pressable
                    disabled={page <= 1}
                    onPress={() => movePage(-1)}
                    style={[s.pageButton, page <= 1 && s.pageButtonDisabled]}
                  >
                    <Text style={s.pageButtonText}>Anterior →</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    disabled={page <= 1}
                    onPress={() => movePage(-1)}
                    style={[s.pageButton, page <= 1 && s.pageButtonDisabled]}
                  >
                    <Text style={s.pageButtonText}>‹ Anterior</Text>
                  </Pressable>

                  <View style={s.pageCenterInfo}>
                    <Text style={s.pageHint}>
                      {page} de {pageCount}
                    </Text>
                    <Text style={s.modeHintBadge}>
                      {readingMode === 'vertical' ? 'ROLAGEM' : 'PÁGINAS (LTR)'}
                    </Text>
                  </View>

                  <Pressable
                    disabled={page >= pageCount}
                    onPress={() => movePage(1)}
                    style={[
                      s.pageButton,
                      s.nextButton,
                      page >= pageCount && s.pageButtonDisabled,
                    ]}
                  >
                    <Text style={s.nextButtonText}>Próxima ›</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {/* EPUB progress footer */}
          {format === 'epub' && (
            <View style={s.progressFooter}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={s.progressText}>{progress}% lido</Text>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  canvas: {
    flex: 1,
    backgroundColor: palette.background,
  },
  flex1: {
    flex: 1,
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    backgroundColor: '#191B29',
    zIndex: 10,
  },
  backButton: {
    width: 32,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  back: {
    fontSize: 34,
    color: palette.violetLight,
    lineHeight: 37,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  heading: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  metaFormat: {
    fontSize: 9,
    fontWeight: '900',
    color: palette.amberLight,
    letterSpacing: 0.8,
  },
  metaDot: {
    fontSize: 8,
    color: palette.mutedDark,
  },
  metaSource: {
    fontSize: 8,
    letterSpacing: 0.8,
    color: palette.muted,
    fontWeight: '800',
  },
  modeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  modeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: palette.violet,
  },
  modeBtnText: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  modeBtnTextActive: {
    color: '#1E192D',
    fontWeight: '900',
  },
  pageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  pageCounter: {
    color: '#EEEAFB',
    fontSize: 11,
    fontWeight: '800',
  },
  fontControls: {
    flexDirection: 'row',
    gap: 5,
  },
  fontButton: {
    height: 32,
    minWidth: 34,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: '#25283A',
  },
  fontButtonText: {
    color: palette.violetLight,
    fontWeight: '900',
    fontSize: 11,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  loading: {
    marginTop: 14,
    color: '#B9BDCD',
    fontSize: 13,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,113,113,0.12)',
    marginBottom: 16,
  },
  errorSymbol: {
    fontSize: 29,
    fontWeight: '900',
    color: '#FFB3B3',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  errorCopy: {
    fontSize: 13,
    color: '#B9BDCD',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: palette.violet,
    borderRadius: 12,
    marginTop: 18,
  },
  retryText: {
    color: '#201A31',
    fontWeight: '900',
    fontSize: 12,
  },
  comicReader: {
    flex: 1,
    backgroundColor: palette.background,
    justifyContent: 'center',
  },
  pageCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  comicPage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapCues: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tapCueSide: {
    width: '20%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.18,
  },
  tapCueText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  verticalContent: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  verticalPageWrap: {
    marginBottom: 16,
    alignItems: 'center',
  },
  verticalPageNumber: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 6,
  },
  readerControls: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: '#1C1F2E',
  },
  pageButton: {
    height: 38,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#24273A',
  },
  pageButtonDisabled: {
    opacity: 0.35,
  },
  pageButtonText: {
    color: '#E2DDF0',
    fontSize: 11,
    fontWeight: '800',
  },
  nextButton: {
    borderColor: 'transparent',
    backgroundColor: palette.violet,
  },
  nextButtonText: {
    color: '#211A34',
    fontSize: 11,
    fontWeight: '900',
  },
  pageCenterInfo: {
    alignItems: 'center',
    gap: 2,
  },
  pageHint: {
    color: '#AEB3C3',
    fontSize: 11,
    fontWeight: '800',
  },
  modeHintBadge: {
    color: palette.amberLight,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  web: {
    flex: 1,
    backgroundColor: palette.background,
  },
  webWrap: {
    flex: 1,
    backgroundColor: palette.background,
  },
  webLoader: {
    flex: 1,
  },
  webShield: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  rarStatus: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rarStatusText: {
    color: '#E8E1F5',
    fontSize: 12,
    fontWeight: '700',
  },
  progressFooter: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: '#1C1F2E',
  },
  progressTrack: {
    height: 5,
    backgroundColor: '#373A4A',
    borderRadius: 9,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    backgroundColor: palette.violet,
    borderRadius: 9,
  },
  progressText: {
    color: '#AEB3C3',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },
});
