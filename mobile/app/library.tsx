import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Action, Badge, BookIcon, Brand, Heading, palette, Screen, useResponsiveLayout } from '../src/components/atoms';
import { WallpaperHero, wallpapers } from '../src/components/WallpaperHero';
import { formatBytes, getProfile } from '../src/lib/account';
import { getBookCoverUrl, getBookProgress, getBooks, pickAndUploadBook, removeBook, updateBook, updateBookCover } from '../src/lib/library';
import { importLocalFiles, importLocalFolder, readRememberedLocalFiles } from '../src/lib/local';
import { checkForAppUpdate, dismissAppUpdate, type AppUpdate } from '../src/lib/updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Book, LocalBook } from '../src/lib/types';

type Entry = {
  key: string;
  title: string;
  format: string;
  detail?: string;
  cover?: string;
  progress?: number;
  local?: LocalBook;
  book?: Book;
};

export default function Library() {
  const { offline } = useLocalSearchParams<{ offline?: string }>();
  const guest = offline === '1';
  const { width, columns, contentPadding, cardGap, maxContentWidth, isTablet } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const [books, setBooks] = useState<Book[]>([]);
  const [local, setLocal] = useState<LocalBook[]>([]);
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [avatar, setAvatar] = useState<string | null>(null);
  const [tab, setTab] = useState<'cloud' | 'local'>(guest ? 'local' : 'cloud');
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
    const loadLocal = readRememberedLocalFiles().then(setLocal).catch(() => {
      Alert.alert('Estante local indisponível', 'Não foi possível carregar a lista de arquivos importados.');
    });

    if (guest) { await loadLocal; return; }

    const loadCloud = getBooks().then(async (items) => {
      setBooks(items);
      setCloudError(false);
      const details = await Promise.all(items.map(async (book) => {
        const [cover, percent] = await Promise.all([
          getBookCoverUrl(book).catch(() => null),
          getBookProgress(book.id).catch(() => 0),
        ]);
        return { id: book.id, cover, percent };
      }));
      setCovers(Object.fromEntries(details.map((entry) => [entry.id, entry.cover])));
      setProgress(Object.fromEntries(details.map((entry) => [entry.id, entry.percent])));
    }).catch(() => setCloudError(true));

    await Promise.all([loadLocal, loadCloud, getProfile().then((account) => setAvatar(account.avatarUrl)).catch(() => {})]);
  }, [guest]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

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

  function closeUpdate() {
    if (update) void dismissAppUpdate(update.version).catch(() => {});
    setUpdate(null);
  }

  const showingLocal = guest || tab === 'local';
  const search = query.trim().toLocaleLowerCase();
  const entries: Entry[] = showingLocal
    ? local.map((book) => ({
      key: book.uri, title: book.name.replace(/\.[^.]+$/, ''), format: book.format,
      local: book, detail: book.size > 0 ? formatBytes(book.size) : undefined,
    }))
    : books.map((book) => ({
      key: book.id, title: book.title, format: book.file_type, detail: book.author,
      cover: covers[book.id] ?? undefined, progress: progress[book.id], book,
    }));
  const filtered = entries.filter((entry) => [entry.title, entry.detail, entry.format].some((value) => value?.toLocaleLowerCase().includes(search)));
  const cardWidth = (Math.min(width - insets.left - insets.right, maxContentWidth) - 2 * contentPadding - (columns - 1) * cardGap) / columns;
  const resume = books.filter((book) => progress[book.id] > 0 && progress[book.id] < 100).slice(0, 5);

  return (
    <Screen>
      <FlatList
        key={columns}
        numColumns={columns}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.list, { paddingHorizontal: contentPadding, maxWidth: maxContentWidth }]}
        columnWrapperStyle={columns > 1 ? { gap: cardGap } : undefined}
        data={filtered}
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
            {!showingLocal && resume.length > 0 && !search && (
              <View style={s.group}>
                <Text accessibilityRole="header" style={s.sectionTitle}>Continuar lendo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
                  {resume.map((book) => (
                    <Pressable key={book.id} style={({ pressed }) => [s.resume, pressed && s.pressed]} onPress={() => router.push({ pathname: '/reader/[id]', params: { id: book.id } })}>
                      <View style={s.resumeMark}><BookIcon size={17} /></View>
                      <View style={s.resumeBody}>
                        <Text numberOfLines={1} style={s.itemTitle}>{book.title}</Text>
                        <Text style={s.subtle}>{progress[book.id]}% lido</Text>
                      </View>
                      <Text style={s.chevron}>›</Text>
                    </Pressable>
                  ))}
                </ScrollView>
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
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.duration(230).delay(Math.min(160, index * 25))} style={[s.cell, { width: cardWidth }]}>
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
            {item.book && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${item.title}`} style={s.more}
                onPress={() => { setEditing(item.book!); setTitle(item.title); setAuthor(item.detail ?? ''); }}>
                <Text style={s.moreLabel}>···</Text>
              </Pressable>
            )}
          </Animated.View>
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
  toolbar: { minHeight: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 48, height: 48, borderRadius: 18, overflow: 'hidden', backgroundColor: palette.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { color: palette.violetLight, fontWeight: '800', fontSize: 12 },
  heroTitle: { fontSize: 34, lineHeight: 40 },
  heroCopy: { color: palette.textSecondary, fontSize: 14 },
  group: { gap: 10 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: palette.text },
  subtle: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  rail: { gap: 9 },
  resume: { width: 222, gap: 9, padding: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border },
  resumeMark: { width: 38, height: 42, borderRadius: 12, backgroundColor: palette.violetGlow, alignItems: 'center', justifyContent: 'center' },
  resumeBody: { flex: 1, gap: 2 },
  chevron: { color: palette.violetLight, fontSize: 22 },
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
