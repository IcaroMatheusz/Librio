import { useCallback, useRef, useState } from 'react';
import { Lucide } from '@react-native-vector-icons/lucide';
import { Alert, FlatList, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import type { Directory, File } from 'expo-file-system';
import * as Linking from 'expo-linking';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Action, Badge, BookIcon, Brand, Heading, palette, Screen, useResponsiveLayout } from '../src/components/atoms';
import { WallpaperHero } from '../src/components/WallpaperHero';
import { wallpapers } from '../src/config/wallpapers';
import { formatBytes, getCloudStorage, getProfile, type StorageInfo } from '../src/lib/account';
import { getBookCoverUrl, getBookProgress, getBooks, pickAndUploadBook, removeBook, updateBook, updateBookCover } from '../src/lib/library';
import {
  changeLocalCategory, changeLocalCover, importLocalFiles, importLocalFolder, localCategory, localFolder, localProgressKey, localTitle,
  readRememberedLocalFiles, removeLocalSelection, renameLocalCategory, restoreLocalCover,
} from '../src/lib/local';
import RarExtractor from '../src/components/RarExtractor';
import { generateLocalCover, getLocalCover } from '../src/lib/localCovers';
import { checkForAppUpdate, dismissAppUpdate, type AppUpdate } from '../src/lib/updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Book, LocalBook } from '../src/lib/types';
import { compareChapterTitles } from '../src/lib/chapterNavigation';
import { cloudProgressKey, hideFromResume, readCheckpoints, type Checkpoint } from '../src/lib/readingHistory';
import { IconButton } from '../src/components/IconButton';
import { useReaderSettings } from '../src/components/ReaderSettings';

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
type LocalEdit = { book: LocalBook } | { category: string };
type PendingRar = { file: File; folder: Directory; done: (uri?: string) => void };

export default function Library() {
  const { offline } = useLocalSearchParams<{ offline?: string }>();
  const guest = offline === '1';
  const { width, columns, contentPadding, cardGap, maxContentWidth, isTablet } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { open: openPreferences } = useReaderSettings();
  const [books, setBooks] = useState<Book[]>([]);
  const [local, setLocal] = useState<LocalBook[]>([]);
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Record<string, Checkpoint>>({});
  const [avatar, setAvatar] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [localCovers, setLocalCovers] = useState<Record<string, string>>({});
  const [pendingRar, setPendingRar] = useState<PendingRar | null>(null);
  const [localEdit, setLocalEdit] = useState<LocalEdit | null>(null);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [tab, setTab] = useState<'cloud' | 'local'>(guest ? 'local' : 'cloud');
  const showingLocal = guest || tab === 'local';
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cloudError, setCloudError] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const checkedUpdate = useRef(false);
  const operation = useRef(false);

  const load = useCallback(async () => {
    const loadLocal = readRememberedLocalFiles().then(async (items) => {
      const saved = await readCheckpoints(items.map(localProgressKey)).catch(() => ({}));
      setLocal(items);
      setHistory((previous) => ({ ...previous, ...saved }));
    }).catch(() => {
      Alert.alert('Estante local indisponível', 'Não foi possível carregar a lista de arquivos importados.');
    });

    if (guest) { await loadLocal; return; }

    const loadCloud = getBooks().then(async (items) => {
      setBooks(items);
      setCloudError(false);
      const saved = await readCheckpoints(items.map((book) => cloudProgressKey(book.id))).catch((): Record<string, Checkpoint> => ({}));
      setHistory((previous) => ({ ...previous, ...saved }));
      const details = await Promise.all(items.map(async (book) => {
        const [cover, percent] = await Promise.all([
          getBookCoverUrl(book).catch(() => null),
          getBookProgress(book.id).catch(() => saved[cloudProgressKey(book.id)]?.percent ?? 0),
        ]);
        return { id: book.id, cover, percent };
      }));
      setCovers(Object.fromEntries(details.map((entry) => [entry.id, entry.cover])));
      setProgress(Object.fromEntries(details.map((entry) => [entry.id, entry.percent])));
    }).catch(() => setCloudError(true));

    await Promise.all([
      loadLocal,
      loadCloud,
      getProfile().then(({ avatarUrl }) => setAvatar(avatarUrl)).catch(() => {}),
      getCloudStorage().then(setStorage).catch(() => {}),
    ]);
  }, [guest]);

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
      Alert.alert('Não foi possível concluir', error instanceof Error ? error.message : 'Tente novamente.');
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
      Alert.alert('Importação concluída', report.join('. ') + '.');
    });
  }

  function editLocal(selection: LocalEdit) {
    setCategoryDraft('book' in selection ? localCategory(selection.book) : selection.category);
    setLocalEdit(selection);
  }

  function removeSelection(selection: Parameters<typeof removeLocalSelection>[0], label: string) {
    Alert.alert('Remover da estante?', `“${label}” sairá da seleção do Librio. Os arquivos originais permanecem no aparelho.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void perform(async () => {
        await removeLocalSelection(selection);
        setLocalEdit(null);
      }) },
    ]);
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
  const resumeWidth = Math.min(290, Math.max(205, width - 90));

  async function removeResume(key: string) {
    try {
      await hideFromResume(key);
      setHistory((previous) => ({ ...previous, [key]: { ...(previous[key] ?? { percent: 0 }), hidden: true } }));
    } catch {
      Alert.alert('Não foi possível remover', 'Tente novamente para tirar esta obra de “Continuar lendo”.');
    }
  }

  return (
    <Screen>
      {pendingRar && <RarExtractor key={pendingRar.folder.uri} file={pendingRar.file} directory={pendingRar.folder} coverOnly
        onStatus={() => {}} onComplete={(pages) => pendingRar.done(pages[0]?.uri)} onError={() => pendingRar.done()} />}
      <FlatList
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.list, { paddingHorizontal: contentPadding, maxWidth: maxContentWidth }]}
        data={rows}
        keyExtractor={(entry) => entry.key}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={palette.violet} onRefresh={() => {
          setRefreshing(true);
          void load().finally(() => setRefreshing(false));
        }} />}
        ListHeaderComponent={
          <View style={s.header}>
            <View style={s.toolbar}>
              <Brand />
              <View style={s.toolbarActions}>
                <IconButton icon="settings-2" label="Preferências de leitura" onPress={openPreferences} />
                {guest ? (
                  <Action title="Entrar" quiet onPress={() => router.replace('/')} />
                ) : (
                  <>
                    <Action title="Volumes" quiet onPress={() => router.push('/volumes')} />
                    <Pressable accessibilityRole="button" accessibilityLabel="Meu perfil" style={s.avatar} onPress={() => router.push('/profile')}>
                      {avatar ? <Image source={{ uri: avatar }} style={s.coverImage} /> : <Text style={s.avatarLabel}>EU</Text>}
                    </Pressable>
                  </>
                )}
              </View>
            </View>
            <WallpaperHero source={wallpapers.library} tall={isTablet}>
              <Heading style={s.heroTitle}>Minha estante</Heading>
              <Text style={s.heroCopy}>{guest ? 'Importe suas obras e leia direto do aparelho.' : `${books.length} na nuvem · ${local.length} neste dispositivo`}</Text>
            </WallpaperHero>
            {resume.length > 0 && !search && (
              <View style={s.group}>
                <Text accessibilityRole="header" style={s.sectionTitle}>Continuar lendo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
                  {resume.map(({ entry, key, percent, saved }) => (
                    <View key={key} style={[s.resume, { width: resumeWidth }]}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Continuar ${entry.title}`}
                        style={({ pressed }) => [s.resumeAction, pressed && s.pressed]}
                        onPress={() => router.push({ pathname: '/reader/[id]', params: entry.local
                          ? { id: 'local', uri: entry.local.uri }
                          : { id: entry.key, volume: saved?.volumeId } })}>
                        <View style={s.resumeCover}>
                          {entry.cover ? <Image source={{ uri: entry.cover }} style={s.resumeArtwork} resizeMode="cover" /> : <BookIcon size={32} />}
                        </View>
                        <View style={s.resumeInfo}>
                          <Text style={s.resumeTitle} numberOfLines={2}>{entry.title}</Text>
                          <View style={s.resumeMeta}>
                            <Lucide name={entry.local ? 'smartphone' : 'cloud'} color={palette.mutedDark} size={14} accessible={false} />
                            <Text style={s.resumeCaption}>{entry.local ? 'No aparelho' : 'Nuvem'}</Text>
                          </View>
                          <View style={s.track}><View style={[s.fill, { width: `${percent}%` }]} /></View>
                          <Text style={s.resumeCaption}>{percent}% lido</Text>
                        </View>
                      </Pressable>
                      <IconButton icon="x" label={`Remover ${entry.title} de Continuar lendo`} onPress={() => void removeResume(key)}
                        style={s.resumeDismiss} size={16} />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
            {!guest && (
              <View style={s.quota}>
                <Text style={s.sectionTitle} accessibilityRole="header">Armazenamento na nuvem</Text>
                {storage ? (
                  <>
                    <Text style={s.quotaFree}>{formatBytes(freeBytes)} disponíveis para envio</Text>
                    <Text style={s.subtle}>{formatBytes(storage.used_bytes)} usados de {formatBytes(storage.max_bytes)}</Text>
                    <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(quotaPercent) }}>
                      <View style={[s.fill, { width: `${quotaPercent}%` }]} />
                    </View>
                  </>
                ) : <Text style={s.subtle}>A cota aparece quando a conta estiver conectada à nuvem.</Text>}
              </View>
            )}
            <View style={s.group}>
              {!guest && (
                <View style={s.tabs}>
                  {(['cloud', 'local'] as const).map((value) => (
                    <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }}
                      onPress={() => { setTab(value); setQuery(''); }}
                      style={[s.tab, tab === value && s.tabActive]}>
                      <Text style={[s.tabLabel, tab === value && s.tabLabelActive]}>{value === 'cloud' ? 'Nuvem' : 'No aparelho'}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Animated.View key={showingLocal ? 'local' : 'cloud'} entering={FadeIn.duration(220)} style={s.group}>
                <View style={s.actions}>
                  <Action style={s.action} title={busy ? 'Aguarde…' : showingLocal ? '+ Importar arquivos' : '+ Enviar à nuvem'} disabled={busy}
                    onPress={() => showingLocal ? void importBooks(false) : void perform(pickAndUploadBook)} />
                  {showingLocal && Platform.OS === 'android' && (
                    <Action style={s.action} title="Importar pasta" quiet disabled={busy} onPress={() => void importBooks(true)} />
                  )}
                </View>
                {showingLocal && folders.size > 0 && (
                  <Action title={`Pastas selecionadas (${folders.size})`} quiet onPress={() => setFoldersOpen(true)} />
                )}
                <TextInput
                  accessibilityLabel="Buscar na estante"
                  placeholder={showingLocal ? 'Buscar arquivos locais' : 'Buscar por título ou autor'}
                  placeholderTextColor={palette.muted}
                  style={s.input}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                />
              </Animated.View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <BookIcon size={26} />
            <Text style={s.sectionTitle}>{search ? 'Nenhum resultado' : !showingLocal && cloudError ? 'Nuvem indisponível' : 'Estante vazia'}</Text>
            <Text style={[s.subtle, s.emptyCopy]}>
              {search ? 'Busque por outro título ou formato.'
                : showingLocal ? 'Importe um CBR, CBZ, EPUB ou PDF para ler offline.'
                : cloudError ? 'Puxe para atualizar ou abra a estante no aparelho.'
                : 'Envie um CBR, CBZ, EPUB ou PDF para começar.'}
            </Text>
          </View>
        }
        renderItem={({ item: row }) => 'category' in row ? (
          <View style={s.categoryHeader}>
            <View style={s.resumeBody}>
              <Text style={s.sectionTitle} accessibilityRole="header">{row.category}</Text>
              <Text style={s.subtle}>{row.count} {row.count === 1 ? 'obra' : 'obras'}</Text>
            </View>
            <Action title="Editar categoria" quiet onPress={() => editLocal({ category: row.category })} />
          </View>
        ) : (
          <View style={[s.gridRow, { gap: cardGap }]}>
            {row.entries.map((item, index) => (
          <Animated.View key={item.key} entering={FadeInDown.duration(230).delay(Math.min(160, index * 25))} style={[s.cell, { width: cardWidth }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ler ${item.title}`}
              onPress={() => router.push({ pathname: '/reader/[id]', params: item.local ? { id: 'local', uri: item.local.uri } : { id: item.key } })}
              style={({ pressed }) => [s.item, pressed && s.pressed]}
            >
              <View style={s.cover}>
                {item.cover ? <Image source={{ uri: item.cover }} style={s.coverImage} resizeMode="cover" /> : <BookIcon size={35} />}
                <View style={s.format}><Badge label={item.format} variant={item.format === 'pdf' ? 'emerald' : 'violet'} /></View>
              </View>
              <View style={s.itemBody}>
                <Text numberOfLines={2} style={s.itemTitle}>{item.title}</Text>
                {!!item.detail && <Text numberOfLines={1} style={s.subtle}>{item.detail}</Text>}
                {!!item.progress && <View style={s.track}><View style={[s.fill, { width: `${item.progress}%` }]} /></View>}
              </View>
            </Pressable>
            {(item.book || item.local) && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${item.title}`} style={s.more}
                onPress={() => {
                  if (item.local) editLocal({ book: item.local });
                  else if (item.book) { setEditing(item.book); setTitle(item.title); setAuthor(item.detail ?? ''); }
                }}>
                <Text style={s.moreLabel}>···</Text>
              </Pressable>
            )}
          </Animated.View>

            ))}
          </View>
        )}
      />
      <Modal visible={!!update} transparent animationType="fade" onRequestClose={closeUpdate}>
        <Screen style={s.modalBackdrop}>
          <View style={s.sheet}>
            <Heading style={s.sectionTitle}>Librio {update?.version} disponível</Heading>
            <Text style={s.subtle}>Baixe o APK para instalar a nova versão no seu aparelho.</Text>
            <Action title="Baixar atualização" onPress={() => {
              if (update) void Linking.openURL(update.downloadUrl).then(() => setUpdate(null)).catch(() => Alert.alert('Download indisponível', 'Confira sua conexão e tente novamente.'));
            }} />
            <Action title="Agora não" quiet onPress={closeUpdate} />
          </View>
        </Screen>
      </Modal>
      <Modal visible={foldersOpen} transparent animationType="slide" onRequestClose={() => setFoldersOpen(false)}>
        <Screen style={s.modalBackdrop}>
          <ScrollView contentContainerStyle={s.modalScroll}>
            <View style={s.sheet}>
              <Heading style={s.sectionTitle}>Pastas selecionadas</Heading>
              {folders.size === 0 && <Text style={s.subtle}>As pastas importadas aparecerão aqui.</Text>}
              {[...folders].map(([uri, info]) => (
                <View key={uri} style={s.categoryHeader}>
                  <View style={s.resumeBody}>
                    <Text style={s.itemTitle}>{info.name}</Text>
                    <Text style={s.subtle}>{info.count} {info.count === 1 ? 'obra' : 'obras'}</Text>
                  </View>
                  <Action title="Remover" danger disabled={busy} onPress={() => removeSelection({ folder: uri }, info.name)} />
                </View>
              ))}
              <Action title="Fechar" outline onPress={() => setFoldersOpen(false)} />
            </View>
          </ScrollView>
        </Screen>
      </Modal>
      <Modal visible={!!localEdit} transparent animationType="slide" onRequestClose={() => setLocalEdit(null)}>
        <Screen style={s.modalBackdrop}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalScroll}>
            {localEdit && (
              <View style={s.sheet}>
                <Heading style={s.sectionTitle}>{'book' in localEdit ? localTitle(localEdit.book.name) : 'Editar categoria'}</Heading>
                <Text style={s.label}>{'book' in localEdit ? 'Categoria da obra' : 'Nome da categoria'}</Text>
                <TextInput accessibilityLabel="Nome da categoria" style={s.input} value={categoryDraft} onChangeText={setCategoryDraft} maxLength={100} />
                <Action title="Salvar categoria" disabled={busy} onPress={() => void perform(async () => {
                  if ('book' in localEdit) await changeLocalCategory(localEdit.book.uri, categoryDraft);
                  else await renameLocalCategory(localEdit.category, categoryDraft);
                  setLocalEdit(null);
                })} />
                {'book' in localEdit && (
                  <>
                    <Action title="Escolher capa" quiet disabled={busy} onPress={() => void perform(async () => {
                      await changeLocalCover(localEdit.book.uri);
                      setLocalEdit(null);
                    })} />
                    {localEdit.book.customCover && <Action title="Restaurar capa automática" outline disabled={busy} onPress={() => void perform(async () => {
                      await restoreLocalCover(localEdit.book.uri);
                      setLocalEdit(null);
                    })} />}
                  </>
                )}
                <Action title="Remover da estante" danger disabled={busy} onPress={() => {
                  if ('book' in localEdit) removeSelection({ uri: localEdit.book.uri }, localTitle(localEdit.book.name));
                  else removeSelection({ category: localEdit.category }, localEdit.category);
                }} />
                <Action title="Fechar" outline onPress={() => setLocalEdit(null)} />
              </View>
            )}
          </ScrollView>
        </Screen>
      </Modal>
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Screen style={s.modalBackdrop}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalScroll}>
            <View style={s.sheet}>
              <Heading style={s.sectionTitle}>Editar obra</Heading>
              <Text style={s.label}>Título</Text>
              <TextInput style={s.input} value={title} onChangeText={setTitle} />
              <Text style={s.label}>Autor</Text>
              <TextInput style={s.input} value={author} onChangeText={setAuthor} />
              <Action title="Alterar capa" quiet disabled={busy} onPress={() => editing && void perform(() => updateBookCover(editing))} />
              <Action title="Salvar" disabled={busy} onPress={() => editing && void perform(async () => {
                await updateBook(editing.id, title, author);
                setEditing(null);
              })} />
              <Action title="Excluir da nuvem" danger disabled={busy} onPress={() => {
                if (editing) Alert.alert('Excluir obra?', `“${editing.title}” será removida da nuvem.`, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Excluir', style: 'destructive', onPress: () => void perform(async () => {
                    await removeBook(editing);
                    setEditing(null);
                  }) },
                ]);
              }} />
              <Action title="Fechar" outline onPress={() => setEditing(null)} />
            </View>
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  list: { alignSelf: 'center', width: '100%', paddingTop: 10, paddingBottom: 32 },
  header: { gap: 19, paddingBottom: 16 },
  toolbar: { minHeight: 50, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 48, height: 48, borderRadius: 18, overflow: 'hidden', backgroundColor: palette.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { color: palette.violetLight, fontWeight: '800', fontSize: 12 },
  heroTitle: { fontSize: 34, lineHeight: 40 },
  heroCopy: { color: palette.textSecondary, fontSize: 14 },
  group: { gap: 10 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: palette.text },
  subtle: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  rail: { gap: 9 },
  resume: { backgroundColor: palette.surface, borderRadius: 18, borderWidth: 1, borderColor: palette.border, overflow: 'hidden' },
  resumeAction: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  resumeCover: { width: 102, minHeight: 151, backgroundColor: palette.cardElevated, alignItems: 'center', justifyContent: 'center' },
  resumeArtwork: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  resumeInfo: { flex: 1, justifyContent: 'flex-end', padding: 12, paddingTop: 47, gap: 5 },
  resumeTitle: { color: palette.text, fontWeight: '900', fontSize: 16, lineHeight: 21 },
  resumeMeta: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  resumeCaption: { color: palette.muted, fontSize: 11 },
  resumeDismiss: { position: 'absolute', top: 4, right: 4, width: 44, height: 44, borderRadius: 12, backgroundColor: palette.input },
  resumeBody: { flex: 1, gap: 2 },
  tabs: { flexDirection: 'row', backgroundColor: palette.surface, borderRadius: 16, padding: 4, gap: 4 },
  tab: { minHeight: 44, flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderRadius: 12 },
  tabActive: { backgroundColor: palette.surfaceLight },
  tabLabel: { color: palette.muted, fontWeight: '700', textAlign: 'center' },
  tabLabelActive: { color: palette.violetLight },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, minWidth: 140 },
  input: { minHeight: 49, paddingHorizontal: 14, paddingVertical: 10, color: palette.text, backgroundColor: palette.surface, borderColor: palette.border, borderRadius: 13, borderWidth: 1 },
  empty: { alignItems: 'center', padding: 25, gap: 8, borderColor: palette.border, borderWidth: 1, borderRadius: 20 },
  emptyCopy: { textAlign: 'center' },
  quota: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, padding: 14, borderRadius: 16, gap: 5 },
  quotaFree: { color: palette.emerald, fontWeight: '800', fontSize: 16 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10, marginTop: 4 },
  gridRow: { flexDirection: 'row', alignItems: 'stretch' },
  cell: { marginBottom: 12 },
  item: { flex: 1, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  cover: { aspectRatio: 1, maxHeight: 230, backgroundColor: palette.cardElevated, alignItems: 'center', justifyContent: 'center' },
  coverImage: { width: '100%', height: '100%' },
  format: { position: 'absolute', left: 8, bottom: 8, borderRadius: 9, backgroundColor: palette.background },
  itemBody: { padding: 10, gap: 4 },
  itemTitle: { color: palette.text, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  more: { position: 'absolute', right: 5, top: 5, width: 44, height: 44, borderRadius: 13, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' },
  moreLabel: { color: palette.text, fontWeight: '900', fontSize: 22 },
  track: { height: 3, marginTop: 6, borderRadius: 3, backgroundColor: palette.surfaceLight, overflow: 'hidden' },
  fill: { backgroundColor: palette.emerald, height: '100%' },
  modalBackdrop: { backgroundColor: 'rgba(13,11,19,.78)', justifyContent: 'center', padding: 14 },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },
  sheet: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border, borderRadius: 22, padding: 20, gap: 9 },
  label: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
});
