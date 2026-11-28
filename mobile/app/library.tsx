import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ActivityIndicator, FlatList, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import type { Directory, File } from 'expo-file-system';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useResponsiveLayout } from '../src/components/atoms';
import { FormScrollView } from '../src/components/FormScrollView';
import { LibraryMasthead, LibraryBookCard, ReadingCard } from '../src/components/LibraryBooks';
import { LibrarySheets, useLibraryFeedback, type LibrarySheet } from '../src/components/LibrarySheets';
import { LibraryButton, LibraryIconButton, LibraryProgress, libraryType, useLibraryTheme } from '../src/design/libraryTheme';
import { formatBytes, getCloudStorage, getProfile, type StorageInfo } from '../src/lib/account';
import { getBookCoverUrl, getBookProgress, getBooks, pickAndUploadBook } from '../src/lib/library';
import {
  importLocalFiles, importLocalFolder, localCategory, localFolder, localProgressKey, localTitle,
  readRememberedLocalFiles,
} from '../src/lib/local';
import RarExtractor from '../src/components/RarExtractor';
import { generateLocalCover, getLocalCover } from '../src/lib/localCovers';
import { checkForAppUpdate, dismissAppUpdate, type AppUpdate } from '../src/lib/updates';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Book, LocalBook } from '../src/lib/types';
import { compareChapterTitles } from '../src/lib/chapterNavigation';
import { cloudProgressKey, hideFromResume, readCheckpoints, type Checkpoint } from '../src/lib/readingHistory';

type Entry = {
  key: string;
  title: string;
  format: string;
  detail?: string;
  cover?: string;
  progress?: number;
  local?: LocalBook;
  category?: string;
  book?: Book;
};

type Row = { key: string; entries: Entry[] } | { key: string; category: string; count: number };
type PendingRar = { file: File; folder: Directory; done: (uri?: string) => void };

function LocalFolderActions({ count, busy, onImport, onManage }: {
  count: number; busy: boolean; onImport?: () => void; onManage: () => void;
}) {
  const { colors } = useLibraryTheme();
  if (!onImport && !count) return null;
  return (
    <View style={[s.folderActions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {onImport && <>
        <LibraryButton label="Importar pasta" variant="quiet" icon="folder-plus" style={s.folderAction} disabled={busy} onPress={onImport} />
        <View style={[s.folderDivider, { backgroundColor: colors.border }]} />
      </>}
      <LibraryButton label={`Pastas selecionadas (${count})`} variant="quiet" icon="folders" style={s.folderAction} onPress={onManage} />
    </View>
  );
}

export default function Library() {

  const { colors } = useLibraryTheme();
  const reducedMotion = useReducedMotion();
  const [sheet, setSheet] = useState<LibrarySheet | null>(null);
  const { notify, notice, dismissNotice } = useLibraryFeedback();
  const { offline } = useLocalSearchParams<{ offline?: string }>();
  const guest = offline === '1';
  const { width, columns, contentPadding, cardGap, maxContentWidth, isTablet } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<Book[]>([]);
  const [local, setLocal] = useState<LocalBook[]>([]);
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Record<string, Checkpoint>>({});
  const [avatar, setAvatar] = useState<string | null>(null);
  const [quotaLoaded, setQuotaLoaded] = useState(false);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [localCovers, setLocalCovers] = useState<Record<string, string>>({});
  const [pendingRar, setPendingRar] = useState<PendingRar | null>(null);
  const [tab, setTab] = useState<'cloud' | 'local'>(guest ? 'local' : 'cloud');
  const showingLocal = guest || tab === 'local';
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [cloudError, setCloudError] = useState(false);
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const checkedUpdate = useRef(false);
  const operation = useRef(false);
  const historyRevision = useRef(0);
  const dismissedAt = useRef(new Map<string, number>());
  const dismissing = useRef(new Set<string>());
  const resumeRail = useRef<ComponentRef<typeof ScrollView>>(null);
  const resumeOffset = useRef(0);
  const resumeViewport = useRef(0);

  const load = useCallback(async () => {
    const revision = historyRevision.current;
    async function loadHistory(keys: string[]) {
      const saved = await readCheckpoints(keys).catch((): Record<string, Checkpoint> => ({}));
      setHistory((previous) => {
        const next = { ...previous };
        for (const [key, checkpoint] of Object.entries(saved)) {
          if ((dismissedAt.current.get(key) ?? 0) <= revision) next[key] = checkpoint;
        }
        return next;
      });
      return saved;
    }
    const loadLocal = readRememberedLocalFiles().then(async (items) => {
      await loadHistory(items.map(localProgressKey));
      setLocal(items);
    }).catch(() => {
      notify('Estante local indisponível', 'Não foi possível carregar a lista de arquivos importados.');
    }).finally(() => setLocalLoaded(true));

    if (guest) { await loadLocal; return; }

    const loadCloud = getBooks().then(async (items) => {
      const saved = await loadHistory(items.map((book) => cloudProgressKey(book.id)));
      setBooks(items);
      setCloudError(false);
      const details = await Promise.all(items.map(async (book) => {
        const [cover, percent] = await Promise.all([
          getBookCoverUrl(book).catch(() => null),
          getBookProgress(book.id).catch(() => saved[cloudProgressKey(book.id)]?.percent ?? 0),
        ]);
        return { id: book.id, cover, percent };
      }));
      setCovers(Object.fromEntries(details.map((entry) => [entry.id, entry.cover])));
      setProgress(Object.fromEntries(details.map((entry) => [entry.id, entry.percent])));
    }).catch(() => setCloudError(true)).finally(() => setCloudLoaded(true));

    await Promise.all([
      loadLocal,
      loadCloud,
      getProfile().then(({ avatarUrl }) => setAvatar(avatarUrl)).catch(() => {}),
      getCloudStorage().then(setStorage).catch(() => {}).finally(() => setQuotaLoaded(true)),
    ]);
  }, [guest, notify]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useFocusEffect(useCallback(() => {
    const decoder = new AbortController();
    const available: Record<string, string> = {};
    const pending = local.filter((book) => {
      try {
        const cover = getLocalCover(book);
        if (cover) available[book.uri] = cover;
        const saved = history[localProgressKey(book)];
        return !cover && (showingLocal || !!(saved && !saved.hidden && saved.percent < 100 && (saved.percent > 0 || saved.lastReadAt)));
      } catch { return false; }
    });
    setLocalCovers(available);
    const rarFallback = (file: File, folder: Directory, signal: AbortSignal) => new Promise<string | undefined>((resolve) => {
      if (signal.aborted || Platform.OS === 'web') { resolve(undefined); return; }
      const abort = () => finish();
      const finish = (uri?: string) => {
        signal.removeEventListener('abort', abort);
        setPendingRar((previous) => previous?.folder === folder ? null : previous);
        resolve(uri);
      };
      signal.addEventListener('abort', abort, { once: true });
      setPendingRar({ file, folder, done: finish });
    });
    void (async () => {
      for (const book of pending) {
        if (decoder.signal.aborted) return;
        const uri = await generateLocalCover(book, decoder.signal, rarFallback).catch(() => undefined);
        if (uri && !decoder.signal.aborted) setLocalCovers((previous) => ({ ...previous, [book.uri]: uri }));
      }
    })();
    return () => decoder.abort();
  }, [local, history, showingLocal]));

  useFocusEffect(useCallback(() => {
    if (checkedUpdate.current || Platform.OS !== 'android') return;
    let active = true;
    void checkForAppUpdate(Constants.expoConfig?.version ?? '0.0.0')
      .then((candidate) => {
        if (active) { checkedUpdate.current = true; setUpdate(candidate); }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []));

  async function perform(action: () => Promise<unknown>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      await action();
      await load();
    } catch (error) {
      notify('Não foi possível concluir', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function importBooks(fromFolder: boolean) {
    await perform(async () => {
      const result = await (fromFolder ? importLocalFolder() : importLocalFiles());
      if (!result) return;
      const { imported, skipped, unavailable } = result;
      const report = [
        imported === 1 ? '1 obra disponível offline' : `${imported} obras adicionadas para leitura offline`,
        skipped ? `${skipped} com formato incompatível` : '',
        unavailable ? `${unavailable} que não puderam ser copiadas` : '',
      ].filter(Boolean);
      notify('Importação concluída', report.join('. ') + '.', 'success');
    });
  }

  function closeUpdate() {
    if (update) void dismissAppUpdate(update.version).catch(() => {});
    setUpdate(null);
  }

  const search = query.trim().toLocaleLowerCase();
  const localEntries: Entry[] = local.map((book) => ({
    key: book.uri, title: localTitle(book.name), format: book.format, category: localCategory(book),
    local: book, detail: book.size > 0 ? formatBytes(book.size) : undefined, cover: localCovers[book.uri],
    progress: history[localProgressKey(book)]?.percent,
  }));
  const cloudEntries: Entry[] = books.map((book) => ({
    key: book.id, title: book.title, format: book.file_type, detail: book.author,
    cover: covers[book.id] ?? undefined, progress: progress[book.id] ?? history[cloudProgressKey(book.id)]?.percent, book,
  }));
  const entries = showingLocal ? localEntries : cloudEntries;
  const filtered = entries.filter((entry) => [entry.title, entry.detail, entry.format, entry.category].some((value) => value?.toLocaleLowerCase().includes(search)));
  const folders = new Map<string, { name: string; count: number }>();
  for (const book of local) {
    const folder = localFolder(book);
    if (folder) folders.set(folder.uri, { name: folder.name, count: (folders.get(folder.uri)?.count ?? 0) + 1 });
  }
  const groups = new Map<string, Entry[]>();
  for (const entry of filtered) {
    const key = entry.category ?? '';
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  const rows: Row[] = [];
  for (const [category, group] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
    if (showingLocal) {
      rows.push({ key: `category:${category}`, category, count: group.length });
      group.sort((a, b) => compareChapterTitles(a.title, b.title) || a.key.localeCompare(b.key));
    }
    for (let i = 0; i < group.length; i += columns) rows.push({ key: group[i].key, entries: group.slice(i, i + columns) });
  }
  const freeBytes = storage ? Math.max(0, storage.max_bytes - storage.used_bytes) : 0;
  const quotaPercent = storage?.max_bytes ? Math.min(100, Math.max(0, storage.used_bytes / storage.max_bytes * 100)) : 0;
  const cardWidth = (Math.min(width - insets.left - insets.right, maxContentWidth) - 2 * contentPadding - (columns - 1) * cardGap) / columns;
  const resume = [...localEntries, ...(!guest ? cloudEntries : [])].flatMap((entry) => {
    const key = entry.local ? localProgressKey(entry.local) : cloudProgressKey(entry.key);
    const saved = history[key];
    const percent = entry.progress ?? 0;
    if (saved?.hidden || percent >= 100 || (percent <= 0 && !saved?.lastReadAt)) return [];
    return [{ entry, key, percent, saved }];
  }).sort((a, b) => (b.saved?.lastReadAt ?? 0) - (a.saved?.lastReadAt ?? 0) || compareChapterTitles(a.entry.title, b.entry.title));
  const shelfWidth = Math.min(width - insets.left - insets.right, maxContentWidth) - contentPadding * 2;
  const resumeWidth = isTablet && resume.length > 1
    ? Math.min(420, (shelfWidth - 10) / 2)
    : Math.min(420, shelfWidth - (resume.length > 1 ? 20 : 0));

  async function removeResume(key: string) {
    if (dismissing.current.has(key)) return;
    dismissing.current.add(key);
    dismissedAt.current.set(key, ++historyRevision.current);
    setHistory((previous) => ({ ...previous, [key]: { ...(previous[key] ?? { percent: 0 }), hidden: true } }));
    try {
      await hideFromResume(key);
    } catch {
      setHistory((previous) => ({ ...previous, [key]: { ...previous[key], hidden: false } }));
      notify('Não foi possível remover', 'Tente novamente para tirar esta obra de “Continuar lendo”.');
    } finally {
      dismissing.current.delete(key);
    }
  }

  function read(entry: Entry, volume?: string) {
    router.push({ pathname: '/reader/[id]', params: entry.local ? { id: 'local', uri: entry.local.uri } : { id: entry.key, volume } });
  }

  function edit(entry: Entry) {
    if (entry.local) setSheet({ kind: 'local', book: entry.local, cover: entry.cover });
    else if (entry.book) setSheet({ kind: 'cloud', book: entry.book, cover: entry.cover });
  }

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]}>
      {pendingRar && <RarExtractor key={pendingRar.folder.uri} file={pendingRar.file} directory={pendingRar.folder} coverOnly
        onStatus={() => {}} onComplete={(pages) => pendingRar.done(pages[0]?.uri)} onError={() => pendingRar.done()} />}
      <FlatList
        renderScrollComponent={props => <FormScrollView {...props} />}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        contentContainerStyle={[s.list, { paddingHorizontal: contentPadding, maxWidth: maxContentWidth }]}
        data={rows}
        keyExtractor={(entry) => entry.key}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} colors={[colors.accent]} onRefresh={() => {
          setRefreshing(true);
          void load().finally(() => setRefreshing(false));
        }} />}
        ListHeaderComponent={
          <View style={s.header}>
            <View style={s.toolbar}>
              <View style={s.wordmark} accessible accessibilityLabel="Librio">
                <Lucide name="book-open" size={22} color={colors.accent} accessible={false} />
                <Text style={[s.logo, { color: colors.text }]}>Librio<Text style={{ color: colors.accent }}>.</Text></Text>
              </View>
              <View style={s.tools}>
                {!guest && <LibraryButton label="Volumes" icon="library-big" variant="quiet" onPress={() => router.push('/volumes')} />}
                <LibraryIconButton icon="settings-2" label="Preferências de leitura" onPress={() => setSheet({ kind: 'preferences' })} />
                {guest ? <LibraryButton label="Entrar" variant="secondary" onPress={() => router.replace('/')} /> :
                  <Pressable accessibilityRole="button" accessibilityLabel="Meu perfil" style={s.avatarButton} onPress={() => router.push('/profile')}>
                    <View style={[s.avatar, { backgroundColor: colors.surface, borderColor: colors.controlBorder }]}>
                      {avatar ? <Image source={{ uri: avatar }} style={s.photo} /> : <Lucide name="user-round" size={18} color={colors.secondary} />}
                    </View>
                  </Pressable>}
              </View>
            </View>
            {!search && <LibraryMasthead count={local.length + (guest ? 0 : books.length)} loading={!localLoaded || (!guest && !cloudLoaded)} tablet={isTablet} />}
            {resume.length > 0 && !search && (
              <View style={s.group}>
                <Text accessibilityRole="header" style={[libraryType.section, { color: colors.text }]}>Continuar lendo</Text>
                <ScrollView ref={resumeRail} horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.rail} scrollEventThrottle={16}
                  onLayout={({ nativeEvent }) => { resumeViewport.current = nativeEvent.layout.width; }}
                  onScroll={({ nativeEvent }) => { resumeOffset.current = nativeEvent.contentOffset.x; }}
                  onContentSizeChange={(contentWidth) => {
                    if (!resumeViewport.current) return;
                    const maxOffset = Math.max(0, contentWidth - resumeViewport.current);
                    if (resumeOffset.current > maxOffset) {
                      resumeOffset.current = maxOffset;
                      resumeRail.current?.scrollTo({ x: maxOffset, animated: false });
                    }
                  }}>
                  {resume.map(({ entry, key, percent, saved }) => <ReadingCard key={key} book={entry} percent={percent}
                    local={!!entry.local} width={resumeWidth} read={() => read(entry, saved?.volumeId)} dismiss={() => void removeResume(key)} />)}
                </ScrollView>
              </View>
            )}
            {!guest && <View style={[s.storage, { borderColor: colors.border }]}>
              <Lucide name="cloud" size={18} color={colors.muted} accessible={false} />
              <View style={s.flex}>
                <View style={s.storageText}>
                  <Text style={[libraryType.label, { color: colors.text }]}>Armazenamento</Text>
                  <Text style={[libraryType.caption, { color: colors.secondary }]}>{storage ? `${formatBytes(freeBytes)} disponíveis para envio` : quotaLoaded ? 'Cota indisponível' : 'Carregando cota…'}</Text>
                </View>
                {storage && <>
                  <LibraryProgress value={quotaPercent} label="Armazenamento utilizado" />
                  <Text style={[libraryType.caption, { color: colors.muted, marginTop: 4 }]}>
                    {formatBytes(storage.used_bytes)} usados de {formatBytes(storage.max_bytes)}
                  </Text>
                </>}
              </View>
            </View>}
            <View style={s.group}>
              <View style={s.sectionRow}>
                <Text accessibilityRole="header" style={[s.flex, libraryType.section, { color: colors.text }]}>Acervo</Text>
                <LibraryButton label={busy ? 'Aguarde…' : showingLocal ? 'Importar arquivos' : 'Enviar à nuvem'}
                  icon={showingLocal ? 'file-plus-2' : 'upload'} disabled={busy} onPress={() => showingLocal ? void importBooks(false) : void perform(pickAndUploadBook)} />
              </View>
              {!guest && <View accessibilityRole="tablist" style={[s.tabs, { borderColor: colors.border }]}>
                {(['cloud', 'local'] as const).map(value => {
                  const selected = tab === value;
                  return <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected }}
                    onPress={() => { setTab(value); setQuery(''); }}
                    style={[s.tab, { borderBottomColor: selected ? colors.accent : 'transparent' }]}>
                    <Lucide name={value === 'cloud' ? 'cloud' : 'smartphone'} size={16} color={selected ? colors.accent : colors.muted} />
                    <Text style={[libraryType.label, { color: selected ? colors.accent : colors.muted }]}>{value === 'cloud' ? 'Nuvem' : 'No aparelho'}</Text>
                  </Pressable>;
                })}
              </View>}
              <View style={[s.search, { backgroundColor: colors.surface, borderColor: colors.controlBorder }]}>
                <Lucide name="search" color={colors.muted} size={17} accessible={false} />
                <TextInput accessibilityLabel="Buscar na estante" placeholder={showingLocal ? 'Buscar arquivos locais' : 'Buscar por título ou autor'}
                  placeholderTextColor={colors.muted} selectionColor={colors.accent} underlineColorAndroid="transparent"
                  style={[s.input, { color: colors.text }]} value={query} onChangeText={setQuery} returnKeyType="search" />
                {!!query && <LibraryIconButton icon="x" label="Limpar busca" onPress={() => setQuery('')} />}
              </View>
              {showingLocal && <LocalFolderActions count={folders.size} busy={busy}
                onImport={Platform.OS === 'android' ? () => void importBooks(true) : undefined}
                onManage={() => setSheet({ kind: 'folders' })} />}
            </View>
          </View>
        }
        ListEmptyComponent={!(showingLocal ? localLoaded : cloudLoaded) ? (
          <View style={s.group}>
            <ActivityIndicator accessibilityLabel="Carregando a estante" color={colors.accent} />
            <View style={[s.grid, { gap: cardGap }]}>{Array.from({ length: columns }, (_, index) => (
              <View key={index} style={{ width: cardWidth, aspectRatio: 2 / 3, borderRadius: 8, backgroundColor: colors.inset }} />
            ))}</View>
          </View>
        ) : <View style={[s.empty, { backgroundColor: colors.surface }]}>
          <Lucide name={search ? 'search' : cloudError && !showingLocal ? 'cloud-off' : 'book-open'} color={colors.accent} size={26} />
          <Text style={[libraryType.section, { color: colors.text }]}>{search ? 'Nenhum resultado' : !showingLocal && cloudError ? 'Nuvem indisponível' : 'Estante vazia'}</Text>
          <Text style={[libraryType.body, s.centerText, { color: colors.secondary }]}>{search ? 'Busque por outro título ou formato.' : showingLocal
            ? 'Importe um CBR, CBZ, EPUB ou PDF para ler offline.' : cloudError ? 'Puxe para atualizar ou abra a estante no aparelho.' : 'Envie um CBR, CBZ, EPUB ou PDF para começar.'}</Text>
        </View>}
        renderItem={({ item: row }) => 'category' in row ? (
          <View style={s.category}>
            <View style={s.flex}>
              <Text accessibilityRole="header" style={[s.categoryTitle, { color: colors.text }]}>{row.category}</Text>
              <Text style={[libraryType.caption, { color: colors.muted }]}>{row.count} {row.count === 1 ? 'obra' : 'obras'}</Text>
            </View>
            <LibraryIconButton icon="pencil" label={`Editar categoria ${row.category}`} onPress={() => setSheet({ kind: 'category', category: row.category })} />
          </View>
        ) : (
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(150)} style={[s.grid, { gap: cardGap }]}>
            {row.entries.map(entry => <LibraryBookCard key={entry.key} book={entry} width={cardWidth} progress={entry.progress}
              read={() => read(entry)} edit={() => edit(entry)} />)}
          </Animated.View>
        )}
      />
      <LibrarySheets sheet={sheet} onClose={() => setSheet(null)} folders={folders}
        cover={sheet?.kind === 'cloud' ? covers[sheet.book.id] : sheet?.kind === 'local' ? localCovers[sheet.book.uri] : undefined}
        update={update} onDismissUpdate={closeUpdate} onDownloaded={() => setUpdate(null)} busy={busy}
        perform={perform} notice={notice} notify={notify} dismissNotice={dismissNotice} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { width: '100%', alignSelf: 'center', paddingTop: 4, paddingBottom: 32 },
  header: { gap: 15, paddingBottom: 14 },
  toolbar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logo: { fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  tools: { flexDirection: 'row', alignItems: 'center' },
  avatarButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  group: { gap: 9 },
  rail: { gap: 10 },
  storage: { flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  storageText: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 6, marginBottom: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabs: { flexDirection: 'row', gap: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 3, borderBottomWidth: 2 },
  search: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  input: { flex: 1, minHeight: 44, fontSize: 15, paddingRight: 8 },
  folderActions: { flexDirection: 'row', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 4 },
  folderAction: { flex: 1, flexDirection: 'column', justifyContent: 'flex-start', gap: 5, paddingHorizontal: 4, paddingVertical: 9 },
  folderDivider: { width: StyleSheet.hairlineWidth, marginVertical: 8 },
  grid: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  category: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  categoryTitle: { fontSize: 18, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, padding: 22, borderRadius: 12 },
  centerText: { textAlign: 'center', maxWidth: 420 },
});
