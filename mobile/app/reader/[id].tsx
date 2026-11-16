import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import PdfReader from '../../src/components/PdfReader';
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
  const [readingFile, setReadingFile] = useState<ReaderFile | null>(null);
  const [pages, setPages] = useState<ReaderPage[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fontScale, setFontScale] = useState(1);
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
  const windowWidth = Dimensions.get('window').width;
  const format = readingFile?.format.toLowerCase() ?? '';
  const localProgressKey = useMemo(() => uri ? `${LOCAL_PROGRESS_PREFIX}${uri}` : '', [uri]);

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
          if (!['pdf', 'epub', 'cbz', 'cbr'].includes(detected)) throw new Error('Este formato ainda não pode ser lido pelo Librio.');
          if (localProgressKey) {
            const saved = Number(await AsyncStorage.getItem(localProgressKey) ?? 0);
            if (active && Number.isFinite(saved)) { setProgress(saved); progressRef.current = saved; }
          }
          if (active) setReadingFile({ file, format: detected, title: localTitle || file.name.replace(/\.[^.]+$/, '') });
        } else if (id && id !== 'local') {
          const client = requireSupabase();
          const { data, error: bookError } = await client.from('books').select('*').eq('id', id).single();
          if (bookError) throw bookError;
          const book = data as Book;
          const detected = book.file_type.toLowerCase();
          if (!['pdf', 'epub', 'cbz', 'cbr'].includes(detected)) throw new Error('Este formato ainda não pode ser lido pelo Librio.');
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
            setReadingFile({ file: cached, format: detected, title: book.title, cloudBookId: book.id });
          }
        } else {
          throw new Error('Não foi possível identificar a obra para leitura.');
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir esta obra.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
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
          setPage(Math.max(1, Math.min(found.length, Math.ceil(progressRef.current / 100 * found.length) || 1)));
        } else if (format === 'epub') {
          setLoadingMessage('Preparando o livro…');
          setEpubHtml(await readEpubHtml(readingFile.file.uri, fontScale, progressRef.current));
        } else {
          setLoadingMessage('Preparando as páginas do quadrinho…');
          const asset = Asset.fromModule(RAR_BUNDLE);
          await asset.downloadAsync();
          if (!asset.localUri) throw new Error('O leitor CBR não está disponível neste APK.');
          const bundle = await new File(asset.localUri).text();
          if (!active) return;
          setRarHtml(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"><style>html,body{margin:0;background:#12131d;color:#e7e2f1;font:16px system-ui}#pages{max-width:900px;margin:0 auto;padding:0 8px 36px}.page{display:block;width:100%;height:auto;max-height:94vh;object-fit:contain;margin:0 auto 12px}#status{position:fixed;inset:0;display:grid;place-items:center;background:#12131d;color:#c8b8ff}</style></head><body><div id="status">Preparando o leitor CBR…</div><main id="pages"></main><script>${bundle}</script></body></html>`);
          setRarLoading(true);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível preparar este arquivo.');
      }
    })();
    return () => { active = false; };
  }, [readingFile, format, fontScale]);

  const persistProgress = useCallback((value: number) => {
    const normalized = Math.max(0, Math.min(100, Math.round(value)));
    if (Math.abs(normalized - progressRef.current) < 1) return;
    progressRef.current = normalized;
    setProgress(normalized);
    if (readingFile?.cloudBookId) void saveBookProgress(readingFile.cloudBookId, normalized).catch(() => {});
    else if (localProgressKey) void AsyncStorage.setItem(localProgressKey, String(normalized)).catch(() => {});
  }, [readingFile, localProgressKey]);

  const onRarMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    let message: ReaderEvent;
    try { message = JSON.parse(event.nativeEvent.data) as ReaderEvent; } catch { return; }
    if (message.type === 'ready-for-file' && !rarStarted && readingFile) {
      setRarStarted(true);
      void (async () => {
        try {
          if (readingFile.file.size > MAX_CBR_BRIDGE_BYTES) throw new Error('Este CBR é grande demais para abrir no leitor local (limite de 120 MB).');
          const data = bytesToBase64(new Uint8Array(await readingFile.file.arrayBuffer()));
          webView.current?.injectJavaScript(`window.LibrioRarReader.open('${data}'); true;`);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível ler este arquivo CBR.');
        }
      })();
    } else if (message.type === 'count' || message.type === 'ready') {
      setRarLoading(false);
      if (message.total) { setPageCount(message.total); setPage(Math.max(1, Math.ceil(progressRef.current / 100 * message.total) || 1)); }
    } else if (message.type === 'loading') {
      setLoadingMessage(message.message || 'Organizando as páginas…');
      setRarLoading(true);
    } else if (message.type === 'page') {
      if (message.current) setPage(message.current);
      if (message.total) setPageCount(message.total);
      if (message.current && message.total) persistProgress(message.current / message.total * 100);
    } else if (message.type === 'progress') {
      setLoadingMessage('Carregando as páginas…');
    } else if (message.type === 'error') {
      setRarLoading(false);
      setError(message.message || 'Não foi possível abrir este arquivo CBR.');
    }
  }, [rarStarted, readingFile, persistProgress]);

  function movePage(delta: number) {
    const next = Math.max(1, Math.min(pageCount, page + delta));
    if (next === page) return;
    setPage(next);
    if (format === 'cbz') persistProgress(pageCount ? next / pageCount * 100 : 0);
    if (format === 'cbr') webView.current?.injectJavaScript(`document.querySelector('[data-page="${next}"]')?.scrollIntoView({behavior:'smooth',block:'start'}); true;`);
  }

  function onWebMessage(event: { nativeEvent: { data: string } }) {
    if (format === 'cbr') { onRarMessage(event); return; }
    try {
      const message = JSON.parse(event.nativeEvent.data) as ReaderEvent;
      if (message.type === 'progress' && typeof message.progress === 'number') persistProgress(message.progress);
    } catch { /* Ignora mensagens que não sejam de progresso. */ }
  }

  function dismissError() { setError(''); router.back(); }

  return <View style={s.screen}>
    <View style={s.header}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={s.backButton}><Text style={s.back}>‹</Text></Pressable>
      <View style={s.brandMark}><BookIcon size={17} color={palette.violetLight}/></View>
      <View style={s.heading}><Text style={s.title} numberOfLines={1}>{readingFile?.title ?? 'Leitor'}</Text><Text style={s.meta}>{uri ? 'NESTE DISPOSITIVO' : 'BIBLIOTECA NA NUVEM'}{format ? ` · ${format.toUpperCase()}` : ''}</Text></View>
      {format === 'epub' && <View style={s.fontControls}><Pressable style={s.fontButton} onPress={() => setFontScale((value) => Math.max(.85, value - .1))}><Text style={s.fontButtonText}>A−</Text></Pressable><Pressable style={s.fontButton} onPress={() => setFontScale((value) => Math.min(1.6, value + .1))}><Text style={s.fontButtonText}>A+</Text></Pressable></View>}
      {pageCount > 0 && format !== 'epub' && <Text style={s.pageCounter}>{page}/{pageCount}</Text>}
    </View>

    {loading ? <Animated.View entering={FadeIn} style={s.center}><ActivityIndicator size="large" color={palette.violet}/><Text style={s.loading}>{loadingMessage}</Text></Animated.View>
      : error ? <Animated.View entering={FadeInDown} style={s.center}><View style={s.errorIcon}><Text style={s.errorSymbol}>!</Text></View><Text style={s.errorTitle}>Não foi possível abrir</Text><Text style={s.errorCopy}>{error}</Text><Pressable style={s.retryButton} onPress={dismissError}><Text style={s.retryText}>Voltar à biblioteca</Text></Pressable></Animated.View>
      : !readingFile ? null
      : format === 'pdf' ? <PdfReader uri={readingFile.file.uri} initialProgress={progress} onProgress={persistProgress} onPage={(current, total) => { setPage(current); setPageCount(total); }} onError={setError}/>
      : format === 'cbz' ? <View style={s.comicReader}>
        <View style={s.pageCanvas}>{pages[page - 1] ? <Animated.View key={page} entering={FadeIn.duration(180)} exiting={FadeOut.duration(100)} style={s.comicPage}><Image source={{ uri: pages[page - 1].uri }} resizeMode="contain" style={{ width: windowWidth - 32, height: '100%' }}/></Animated.View>
          : <View style={s.center}><ActivityIndicator size="large" color={palette.violet}/><Text style={s.loading}>{error || loadingMessage}</Text></View>}
        </View>
        <View style={s.readerControls}><Pressable disabled={page <= 1} onPress={() => movePage(-1)} style={[s.pageButton, page <= 1 && s.pageButtonDisabled]}><Text style={s.pageButtonText}>‹ Anterior</Text></Pressable><Text style={s.pageHint}>{pageCount ? `${page} de ${pageCount}` : 'Carregando'}</Text><Pressable disabled={page >= pageCount} onPress={() => movePage(1)} style={[s.pageButton, s.nextButton, page >= pageCount && s.pageButtonDisabled]}><Text style={s.nextButtonText}>Próxima ›</Text></Pressable></View>
      </View>
      : format === 'epub' ? epubHtml ? <WebView source={{ html: epubHtml, baseUrl: 'https://librio.local/' }} style={s.web} originWhitelist={['*']} onMessage={onWebMessage} startInLoadingState renderLoading={() => <ActivityIndicator style={s.webLoader} size="large" color={palette.violet}/>} /> : <View style={s.center}><ActivityIndicator size="large" color={palette.violet}/><Text style={s.loading}>{loadingMessage}</Text></View>
      : format === 'cbr' ? rarHtml ? <View style={s.webWrap}><WebView ref={webView as any} source={{ html: rarHtml, baseUrl: 'https://librio.local/' }} style={s.web} originWhitelist={['*']} onMessage={onWebMessage} onLoadEnd={() => setRarReady(true)} javaScriptEnabled domStorageEnabled startInLoadingState renderLoading={() => <ActivityIndicator style={s.webLoader} size="large" color={palette.violet}/>} /><View pointerEvents="none" style={s.rarStatus}><Text style={s.rarStatusText}>{rarLoading && loadingMessage}</Text></View>{!rarReady && <View style={s.webShield}><ActivityIndicator size="large" color={palette.violet}/><Text style={s.loading}>Preparando o leitor CBR…</Text></View>}</View> : <View style={s.center}><ActivityIndicator size="large" color={palette.violet}/><Text style={s.loading}>{loadingMessage}</Text></View>
      : null}
    {format === 'cbr' && pageCount > 0 && <View style={s.readerControls}><Pressable disabled={page <= 1} onPress={() => movePage(-1)} style={[s.pageButton, page <= 1 && s.pageButtonDisabled]}><Text style={s.pageButtonText}>‹ Anterior</Text></Pressable><Text style={s.pageHint}>{page} de {pageCount}</Text><Pressable disabled={page >= pageCount} onPress={() => movePage(1)} style={[s.pageButton, s.nextButton, page >= pageCount && s.pageButtonDisabled]}><Text style={s.nextButtonText}>Próxima ›</Text></Pressable></View>}
    {format === 'epub' && <View style={s.progressFooter}><View style={s.progressTrack}><View style={[s.progressFill, { width: `${progress}%` }]}/></View><Text style={s.progressText}>{progress}% lido</Text></View>}
  </View>;
}

const s=StyleSheet.create({screen:{flex:1,backgroundColor:palette.background},header:{minHeight:62,flexDirection:'row',alignItems:'center',paddingHorizontal:14,gap:9,borderBottomColor:palette.border,borderBottomWidth:1,backgroundColor:'#191B29'},backButton:{width:30,height:38,justifyContent:'center'},back:{fontSize:34,color:palette.violetLight,lineHeight:37},brandMark:{width:35,height:35,borderRadius:12,backgroundColor:'rgba(184,164,245,.12)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(184,164,245,.2)'},heading:{flex:1},title:{color:'#fff',fontSize:14,fontWeight:'900'},meta:{fontSize:8,letterSpacing:1.1,color:'#9BA2B7',fontWeight:'800',marginTop:3},pageCounter:{color:'#EEEAFB',fontSize:12,fontWeight:'800',paddingHorizontal:7},fontControls:{flexDirection:'row',gap:6},fontButton:{height:34,minWidth:37,paddingHorizontal:7,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:palette.border,borderRadius:10,backgroundColor:'#25283A'},fontButtonText:{color:palette.violetLight,fontWeight:'900',fontSize:12},center:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:30},loading:{marginTop:14,color:'#B9BDCD',fontSize:13},errorIcon:{width:56,height:56,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(248,113,113,.12)',marginBottom:16},errorSymbol:{fontSize:29,fontWeight:'900',color:'#FFB3B3'},errorTitle:{fontSize:23,fontWeight:'900',color:'#fff',textAlign:'center'},errorCopy:{fontSize:13,color:'#B9BDCD',textAlign:'center',lineHeight:21,marginTop:10},retryButton:{paddingHorizontal:19,paddingVertical:13,backgroundColor:palette.violet,borderRadius:13,marginTop:19},retryText:{color:'#201A31',fontWeight:'900',fontSize:12},comicReader:{flex:1,backgroundColor:palette.background},pageCanvas:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:16,paddingVertical:10},comicPage:{flex:1,width:'100%',alignItems:'center',justifyContent:'center'},readerControls:{minHeight:60,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:17,borderTopWidth:1,borderTopColor:palette.border,backgroundColor:'#1C1F2E'},pageButton:{height:38,paddingHorizontal:14,justifyContent:'center',borderRadius:12,borderWidth:1,borderColor:palette.border,backgroundColor:'#24273A'},pageButtonDisabled:{opacity:.35},pageButtonText:{color:'#E2DDF0',fontSize:11,fontWeight:'800'},nextButton:{borderColor:'transparent',backgroundColor:palette.violet},nextButtonText:{color:'#211A34',fontSize:11,fontWeight:'900'},pageHint:{color:'#AEB3C3',fontSize:11,fontWeight:'800'},web:{flex:1,backgroundColor:palette.background},webWrap:{flex:1,backgroundColor:palette.background},webLoader:{flex:1},webShield:{position:'absolute',top:0,right:0,bottom:0,left:0,alignItems:'center',justifyContent:'center',backgroundColor:palette.background},rarStatus:{position:'absolute',top:12,left:0,right:0,alignItems:'center'},rarStatusText:{color:'#E8E1F5',fontSize:12,fontWeight:'700'},progressFooter:{paddingHorizontal:18,paddingVertical:12,borderTopWidth:1,borderTopColor:palette.border,backgroundColor:'#1C1F2E'},progressTrack:{height:5,backgroundColor:'#373A4A',borderRadius:9,overflow:'hidden'},progressFill:{height:5,backgroundColor:palette.violet,borderRadius:9},progressText:{color:'#AEB3C3',fontSize:10,marginTop:6,textAlign:'right'}});
