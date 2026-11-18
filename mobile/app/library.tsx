import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import {
  Action,
  Badge,
  BookIcon,
  Brand,
  Eyebrow,
  Heading,
  palette,
  Screen,
  Surface,
  useResponsiveLayout,
} from '../src/components/atoms';
import { formatBytes, getProfile, type StorageInfo } from '../src/lib/account';
import {
  chooseDirectory,
  chooseLocalFiles,
  getBookCoverUrl,
  getBooks,
  getBookProgress,
  pickAndUploadBook,
  readRememberedLocalFiles,
  rememberLocalFiles,
  removeBook,
  updateBook,
  updateBookCover,
} from '../src/lib/library';
import { requireSupabase } from '../src/lib/supabase';
import { checkForAppUpdate, dismissAppUpdate, type AppUpdate } from '../src/lib/updates';
import type { Book, LocalBook } from '../src/lib/types';

// Character Assets for Educational Guides and Banners
const heroBannerArt = require('../../assets/absoluteflash.png');
const nightwingArt = require('../../assets/nightwing.png');
const narutoArt = require('../../assets/naruto.png');
const gokuArt = require('../../assets/goku.webp');

type VolumePreview = { id: string; title: string; author: string };

type GuideTip = {
  id: string;
  badge: string;
  badgeVariant: 'violet' | 'amber' | 'emerald';
  title: string;
  description: string;
  image: any;
  actionText?: string;
  onAction?: () => void;
};

export default function Library() {
  const { width: windowWidth } = useWindowDimensions();
  const { isTablet, isLargeTablet, columns, contentPadding, cardGap } = useResponsiveLayout();

  const [books, setBooks] = useState<Book[]>([]);
  const [local, setLocal] = useState<LocalBook[]>([]);
  const [volumes, setVolumes] = useState<VolumePreview[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [storage, setStorage] = useState<StorageInfo>({
    used_bytes: 0,
    max_bytes: 104857600,
  });
  const [name, setName] = useState('Sua estante');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'cloud' | 'local'>('cloud');
  const [editing, setEditing] = useState<Book | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [appUpdate, setAppUpdate] = useState<AppUpdate | null>(null);
  const [updateChecked, setUpdateChecked] = useState(false);
  const [activeGuideIndex, setActiveGuideIndex] = useState(0);
  const [showGuides, setShowGuides] = useState(true);

  const load = useCallback(async () => {
    try {
      const [cloud, files, account] = await Promise.all([
        getBooks(),
        readRememberedLocalFiles(),
        getProfile(),
      ]);
      setBooks(cloud);
      setLocal(files);
      setStorage(account.storage);
      setName(account.profile.username || 'Sua estante');
      setAvatar(account.avatarUrl);

      const { data: volumeRows, error: volumeError } = await requireSupabase()
        .from('book_volumes')
        .select('id,title,author')
        .order('created_at', { ascending: false })
        .limit(4);

      setVolumes(volumeError ? [] : ((volumeRows ?? []) as VolumePreview[]));

      const [reads, coverEntries] = await Promise.all([
        Promise.all(
          cloud.map(async (book) => [book.id, await getBookProgress(book.id)] as const)
        ),
        Promise.all(
          cloud.map(async (book) => [book.id, await getBookCoverUrl(book)] as const)
        ),
      ]);

      setProgress(Object.fromEntries(reads));
      setCovers(
        Object.fromEntries(
          coverEntries.filter(
            (entry): entry is readonly [string, string] => Boolean(entry[1])
          )
        )
      );
    } catch (error) {
      Alert.alert(
        'Não foi possível carregar a biblioteca',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      if (updateChecked) return;
      let active = true;
      void checkForAppUpdate(Constants.expoConfig?.version ?? '0.0.0')
        .then((update) => {
          if (active) setAppUpdate(update);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setUpdateChecked(true);
        });
      return () => {
        active = false;
      };
    }, [updateChecked])
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return books.filter(
      (book) =>
        !q ||
        book.title.toLocaleLowerCase().includes(q) ||
        book.author.toLocaleLowerCase().includes(q)
    );
  }, [books, search]);

  const filteredLocal = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return local.filter((book) => !q || book.name.toLocaleLowerCase().includes(q));
  }, [local, search]);

  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (error) {
      Alert.alert(
        'Não foi possível concluir',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function onFolder() {
    await perform(async () => {
      const found = await chooseDirectory();
      await rememberLocalFiles(found);
      Alert.alert(
        'Pasta analisada',
        `${found.length} arquivo(s) compatível(is) encontrado(s).`
      );
    });
  }

  async function signOut() {
    await requireSupabase().auth.signOut();
    router.replace('/');
  }

  function editBook(book: Book) {
    setEditing(book);
    setTitle(book.title);
    setAuthor(book.author);
  }

  async function saveBook() {
    if (!editing) return;
    await perform(async () => {
      await updateBook(editing.id, title, author);
      setEditing(null);
    });
  }

  const pct = storage.max_bytes
    ? Math.min((storage.used_bytes / storage.max_bytes) * 100, 100)
    : 0;

  // Informative Tutorials / Educational Guides using character assets
  const guideTips: GuideTip[] = useMemo(
    () => [
      {
        id: 'reading-modes',
        badge: 'GUIA DE LEITURA',
        badgeVariant: 'violet',
        title: '3 Modos de Leitura no Librio',
        description:
          'No leitor, alterne entre Mangá (RTL com avanço pela esquerda), Páginas (LTR clássico) ou Rolagem contínua para manhwas e webtoons.',
        image: nightwingArt,
      },
      {
        id: 'formats',
        badge: 'COMPATIBILIDADE',
        badgeVariant: 'amber',
        title: 'Suporte a .CBR, .CBZ, .EPUB e .PDF',
        description:
          'Abra quadrinhos compactados em ZIP ou RAR, e-books em texto responsivo com controle de fonte e PDFs com renderização nativa de alta velocidade.',
        image: narutoArt,
      },
      {
        id: 'volumes',
        badge: 'ORGANIZAÇÃO',
        badgeVariant: 'emerald',
        title: 'Crie Volumes e Monte Sagas',
        description:
          'Agrupe múltiplos arquivos em uma saga única dividida em capítulos para uma experiência contínua e organizada.',
        image: gokuArt,
        actionText: 'Criar volume agora',
        onAction: () => router.push('/volumes'),
      },
    ],
    []
  );

  const activeGuide = guideTips[activeGuideIndex];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          s.page,
          {
            paddingHorizontal: contentPadding,
            maxWidth: isLargeTablet ? 1160 : isTablet ? 900 : '100%',
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={palette.violet}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        {/* Navigation Topbar */}
        <View style={s.nav}>
          <Pressable onPress={() => router.replace('/library')}>
            <Brand showBadge />
          </Pressable>

          <View style={s.navActions}>
            <Pressable
              style={s.navButton}
              onPress={() => router.push('/volumes')}
            >
              <Text style={s.navButtonText}>▤ Volumes</Text>
            </Pressable>

            <Pressable
              style={s.addButton}
              onPress={() => {
                setTab('cloud');
                void perform(pickAndUploadBook);
              }}
            >
              <Text style={s.addButtonText}>＋ Adicionar</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/profile')}
              style={s.avatarWrap}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={s.avatar} />
              ) : (
                <Text style={s.avatarLetter}>{name.slice(0, 1).toUpperCase()}</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Hero Banner with Web-like Visuals */}
        <Animated.View
          entering={FadeInDown.duration(420)}
          style={[s.hero, isTablet && s.heroTablet]}
        >
          <View style={s.heroGlow} />
          <View style={s.heroCopy}>
            <View style={s.kicker}>
              <Text style={s.spark}>✧</Text>
              <Text style={s.kickerText}>SEU UNIVERSO DE HISTÓRIAS</Text>
            </View>
            <Heading style={s.heroTitle}>Minha biblioteca</Heading>
            <Text style={s.heroSubtitle}>
              Todas as suas aventuras reunidas. Escolha uma história e continue de onde parou.
            </Text>
            <View style={s.heroPillGroup}>
              <View style={s.collectionPill}>
                <BookIcon size={14} color="#FBBF24" />
                <Text style={s.collectionText}>
                  {books.length} {books.length === 1 ? 'obra na nuvem' : 'obras na nuvem'}
                </Text>
              </View>
              {local.length > 0 && (
                <View style={s.collectionPill}>
                  <Text style={s.collectionPillIcon}>📁</Text>
                  <Text style={s.collectionText}>{local.length} locais</Text>
                </View>
              )}
            </View>
          </View>

          <Image source={heroBannerArt} resizeMode="contain" style={s.heroArt} />
          <View style={s.heroTag}>
            <Text style={s.heroTagText}>LEITURA OFFLINE & NUVEM</Text>
          </View>
        </Animated.View>

        {/* Informative Character Guide / Educational Tutorial Banner */}
        {showGuides && (
          <Surface style={s.guideSurface} glow>
            <View style={s.guideLayout}>
              <View style={s.guideInfo}>
                <View style={s.guideHeaderRow}>
                  <Badge
                    label={activeGuide.badge}
                    variant={activeGuide.badgeVariant}
                  />
                  <View style={s.guidePagination}>
                    {guideTips.map((tip, idx) => (
                      <Pressable
                        key={tip.id}
                        onPress={() => setActiveGuideIndex(idx)}
                        style={[
                          s.guideDot,
                          idx === activeGuideIndex && s.guideDotActive,
                        ]}
                      />
                    ))}
                  </View>
                </View>

                <Text style={s.guideTitle}>{activeGuide.title}</Text>
                <Text style={s.guideDesc}>{activeGuide.description}</Text>

                <View style={s.guideActionRow}>
                  {activeGuide.onAction && (
                    <Pressable
                      style={s.guideActionBtn}
                      onPress={activeGuide.onAction}
                    >
                      <Text style={s.guideActionBtnText}>
                        {activeGuide.actionText} →
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={s.guideNextBtn}
                    onPress={() =>
                      setActiveGuideIndex((prev) => (prev + 1) % guideTips.length)
                    }
                  >
                    <Text style={s.guideNextBtnText}>
                      Próxima dica ({activeGuideIndex + 1}/{guideTips.length}) ›
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={s.guideImageWrap}>
                <Image
                  source={activeGuide.image}
                  resizeMode="contain"
                  style={s.guideImage}
                />
              </View>
            </View>
          </Surface>
        )}

        {/* Cloud Storage Card */}
        <Surface style={s.storage}>
          <View style={s.storageHead}>
            <View>
              <Text style={s.storageTitle}>Armazenamento da Conta</Text>
              <Text style={s.storageNumbers}>
                {formatBytes(storage.used_bytes)} de {formatBytes(storage.max_bytes)} ({pct.toFixed(0)}%)
              </Text>
            </View>
            <View style={s.storageIcon}>
              <BookIcon size={18} color={palette.violetLight} />
            </View>
          </View>
          <View style={s.track}>
            <View style={[s.trackFill, { width: `${pct}%` }]} />
          </View>
          <Text style={s.storageFree}>
            {formatBytes(Math.max(0, storage.max_bytes - storage.used_bytes))} disponíveis para novas obras
          </Text>
        </Surface>

        {/* Volumes Rail */}
        <View style={s.sectionHead}>
          <View>
            <Eyebrow>LEITURA ORGANIZADA</Eyebrow>
            <Text style={s.sectionTitle}>Seus volumes</Text>
          </View>
          <Pressable onPress={() => router.push('/volumes')}>
            <Text style={s.underlink}>Ver todos ou montar outro</Text>
          </Pressable>
        </View>

        {volumes.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.volumeRail}
          >
            {volumes.map((volume) => (
              <Pressable
                key={volume.id}
                style={s.volumeCard}
                onPress={() => router.push('/volumes')}
              >
                <View style={s.volumeArtwork}>
                  <BookIcon size={32} color="rgba(167, 139, 250, 0.45)" />
                </View>
                <View style={s.chapterBadge}>
                  <Text style={s.chapterBadgeText}>SAGA</Text>
                </View>
                <Text style={s.volumeTitle} numberOfLines={2}>
                  {volume.title}
                </Text>
                <Text style={s.volumeAuthor} numberOfLines={1}>
                  {volume.author || 'Autor não informado'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Pressable
            style={s.emptyVolume}
            onPress={() => router.push('/volumes')}
          >
            <View style={s.emptyVolumeIcon}>
              <BookIcon size={19} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.emptyVolumeTitle}>Organize sua próxima saga</Text>
              <Text style={s.emptyVolumeSub}>
                Agrupe PDFs, CBRs e CBZs em capítulos sequenciais.
              </Text>
            </View>
            <Text style={s.arrow}>›</Text>
          </Pressable>
        )}

        {/* Collection Section */}
        <View style={s.sectionHead}>
          <View>
            <Eyebrow>SEU ESPAÇO DE LEITURA</Eyebrow>
            <Heading style={s.collectionHeading}>Obras na estante</Heading>
            <Text style={s.sectionSub}>Suas histórias, prontas para continuar.</Text>
          </View>
          <Pressable
            style={s.refresh}
            onPress={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          >
            <Text style={s.refreshText}>↻</Text>
          </Pressable>
        </View>

        {/* Filter Tabs & Search Bar */}
        <View style={s.collectionToolbar}>
          <View style={s.tabs}>
            <Pressable
              style={[s.tab, tab === 'cloud' && s.activeTab]}
              onPress={() => setTab('cloud')}
            >
              <Text style={[s.tabText, tab === 'cloud' && s.activeTabText]}>
                Nuvem <Text style={s.tabCount}>{books.length}</Text>
              </Text>
            </Pressable>
            <Pressable
              style={[s.tab, tab === 'local' && s.activeTab]}
              onPress={() => setTab('local')}
            >
              <Text style={[s.tabText, tab === 'local' && s.activeTabText]}>
                Neste dispositivo <Text style={s.tabCount}>{local.length}</Text>
              </Text>
            </Pressable>
          </View>
        </View>

        <TextInput
          style={s.search}
          value={search}
          onChangeText={setSearch}
          placeholder="⌕ Buscar por título ou autor..."
          placeholderTextColor="#858BA0"
        />

        {tab === 'local' && (
          <View style={s.localActions}>
            <Action
              title={busy ? 'Analisando pasta…' : '＋ Analisar uma pasta'}
              onPress={() => void onFolder()}
              disabled={busy}
            />
            <Action
              title="Escolher arquivos individuais"
              quiet
              onPress={() =>
                void perform(async () => {
                  const files = await chooseLocalFiles();
                  await rememberLocalFiles(files);
                })
              }
              disabled={busy}
            />
          </View>
        )}

        {refreshing && <ActivityIndicator color={palette.violet} />}

        {/* Book Grid - Responsive Columns (2 on phone, 3 on tablet, 4 on large tablet) */}
        {tab === 'cloud' ? (
          <FlatList
            key={`cloud-grid-${columns}`}
            numColumns={columns}
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            columnWrapperStyle={[s.gridRow, { gap: cardGap }]}
            contentContainerStyle={s.grid}
            ListEmptyComponent={
              <View style={s.emptyContainer}>
                <BookIcon size={36} color="rgba(167, 139, 250, 0.4)" />
                <Text style={s.empty}>
                  {search
                    ? 'Nenhuma obra encontrada para esta busca.'
                    : 'Sua estante na nuvem está vazia. Toque em "＋ Adicionar" para subir PDFs, EPUBs, CBRs ou CBZs.'}
                </Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInDown.delay(Math.min(index * 30, 240)).duration(280)}
                style={[
                  s.gridCell,
                  { maxWidth: `${(100 / columns).toFixed(1)}%` },
                ]}
              >
                <Pressable
                  style={s.bookCard}
                  onPress={() =>
                    router.push({
                      pathname: '/reader/[id]',
                      params: { id: item.id },
                    })
                  }
                >
                  <View style={[s.bookCover, isTablet && s.bookCoverTablet]}>
                    {covers[item.id] ? (
                      <Image
                        source={{ uri: covers[item.id] }}
                        resizeMode="cover"
                        style={s.coverArt}
                      />
                    ) : (
                      <View style={s.noCover}>
                        <BookIcon size={isTablet ? 42 : 34} />
                        <Text style={s.noCoverFormat}>
                          {item.file_type.toUpperCase()}
                        </Text>
                        <Text style={s.noCoverLabel}>SEM CAPA</Text>
                      </View>
                    )}
                    <View style={s.coverBadgeWrap}>
                      <Badge
                        label={item.file_type.toUpperCase()}
                        variant={
                          item.file_type.toLowerCase() === 'epub'
                            ? 'amber'
                            : item.file_type.toLowerCase() === 'cbz' ||
                              item.file_type.toLowerCase() === 'cbr'
                            ? 'violet'
                            : 'emerald'
                        }
                      />
                    </View>
                    <Pressable
                      hitSlop={12}
                      onPress={() => editBook(item)}
                      style={s.more}
                    >
                      <Text style={s.moreText}>•••</Text>
                    </Pressable>
                  </View>

                  <Text style={s.bookTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={s.bookAuthor} numberOfLines={1}>
                    {item.author || 'Autor não informado'}
                  </Text>

                  <View style={s.progressTrack}>
                    <View
                      style={[
                        s.progressFill,
                        { width: `${progress[item.id] ?? 0}%` },
                      ]}
                    />
                  </View>
                  <Text style={s.progressLabel}>
                    {progress[item.id]
                      ? `${progress[item.id]}% concluído`
                      : 'Ainda não iniciado'}
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          />
        ) : (
          <FlatList
            key={`local-grid-${columns}`}
            numColumns={columns}
            scrollEnabled={false}
            data={filteredLocal}
            keyExtractor={(item) => item.uri}
            columnWrapperStyle={[s.gridRow, { gap: cardGap }]}
            contentContainerStyle={s.grid}
            ListEmptyComponent={
              <View style={s.emptyContainer}>
                <BookIcon size={36} color="rgba(167, 139, 250, 0.4)" />
                <Text style={s.empty}>
                  {search
                    ? 'Nenhum arquivo local encontrado com este termo.'
                    : 'Nenhum arquivo local salvo. Escolha uma pasta ou arquivos para ler offline.'}
                </Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInDown.delay(Math.min(index * 30, 240)).duration(280)}
                style={[
                  s.gridCell,
                  { maxWidth: `${(100 / columns).toFixed(1)}%` },
                ]}
              >
                <Pressable
                  style={s.bookCard}
                  onPress={() =>
                    router.push({
                      pathname: '/reader/[id]',
                      params: {
                        id: 'local',
                        uri: item.uri,
                        title: item.name,
                        format: item.format,
                      },
                    })
                  }
                >
                  <View style={[s.bookCover, isTablet && s.bookCoverTablet]}>
                    <View style={s.noCover}>
                      <BookIcon size={isTablet ? 42 : 34} />
                      <Text style={s.noCoverFormat}>
                        {item.format.toUpperCase()}
                      </Text>
                      <Text style={s.noCoverLabel}>LOCAL</Text>
                    </View>
                    <View style={s.coverBadgeWrap}>
                      <Badge label={item.format.toUpperCase()} variant="neutral" />
                    </View>
                  </View>

                  <Text style={s.bookTitle} numberOfLines={2}>
                    {item.name.replace(/\.[^.]+$/, '')}
                  </Text>
                  <Text style={s.bookAuthor}>Neste dispositivo</Text>
                  <Text style={s.progressLabel}>{formatBytes(item.size)}</Text>
                </Pressable>
              </Animated.View>
            )}
          />
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Librio • Feito para quem sempre tem mais uma história para ler.
          </Text>
          <Pressable onPress={() => void signOut()}>
            <Text style={s.signOut}>Sair da conta</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* App Update Modal */}
      <Modal
        visible={!!appUpdate}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (appUpdate) {
            void dismissAppUpdate(appUpdate.version);
            setAppUpdate(null);
          }
        }}
      >
        <View style={s.updateShade}>
          <View style={s.updateCard}>
            <View style={s.updateIcon}>
              <BookIcon size={24} />
            </View>
            <Eyebrow>UMA NOVIDADE NA ESTANTE</Eyebrow>
            <Text style={s.updateTitle}>Librio {appUpdate?.version} chegou</Text>
            <Text style={s.updateCopy}>
              Uma nova versão com melhorias no leitor e suporte aprimorado está disponível.
              O Android abrirá o instalador para atualizar o aplicativo.
            </Text>
            <Action
              title="Baixar atualização"
              onPress={() => {
                if (appUpdate) {
                  void Linking.openURL(appUpdate.downloadUrl).catch(() =>
                    Alert.alert(
                      'Não foi possível abrir o download',
                      'Confira sua conexão e tente novamente.'
                    )
                  );
                }
                setAppUpdate(null);
              }}
              style={{ marginTop: 18 }}
            />
            <Pressable
              onPress={() => {
                if (appUpdate) void dismissAppUpdate(appUpdate.version);
                setAppUpdate(null);
              }}
              style={s.updateLater}
            >
              <Text style={s.updateLaterText}>Agora não</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Edit Book Modal */}
      <Modal
        visible={!!editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <View style={s.modalShade}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <View>
                <Eyebrow>DETALHES DA OBRA</Eyebrow>
                <Text style={s.modalTitle}>Editar obra</Text>
              </View>
              <Pressable onPress={() => setEditing(null)}>
                <Text style={s.close}>×</Text>
              </Pressable>
            </View>

            <Text style={s.label}>Título</Text>
            <TextInput
              style={s.modalInput}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={s.label}>Autor</Text>
            <TextInput
              style={s.modalInput}
              value={author}
              onChangeText={setAuthor}
            />

            <Action
              title="Alterar capa"
              quiet
              onPress={() => editing && void perform(() => updateBookCover(editing))}
              disabled={busy}
              style={{ marginTop: 14 }}
            />

            <Action
              title={busy ? 'Salvando…' : 'Salvar alterações'}
              onPress={() => void saveBook()}
              disabled={busy}
              style={{ marginTop: 9 }}
            />

            <Pressable
              style={s.deleteButton}
              onPress={() =>
                editing &&
                Alert.alert(
                  'Excluir obra?',
                  `“${editing.title}” será removida da nuvem.`,
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Excluir',
                      style: 'destructive',
                      onPress: () => {
                        const target = editing;
                        setEditing(null);
                        void perform(() => removeBook(target));
                      },
                    },
                  ]
                )
              }
            >
              <Text style={s.deleteText}>Excluir obra</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: {
    paddingTop: 4,
    paddingBottom: 40,
    gap: 18,
  },
  nav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navButton: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    color: '#EEEAFB',
    fontWeight: '800',
    fontSize: 11,
  },
  addButton: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: palette.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#211A34',
    fontWeight: '900',
    fontSize: 11,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#3A334E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: palette.violetLight,
  },
  avatar: {
    width: 38,
    height: 38,
  },
  avatarLetter: {
    color: palette.violetLight,
    fontWeight: '900',
    fontSize: 14,
  },
  hero: {
    minHeight: 215,
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(216,204,255,.18)',
    backgroundColor: '#211C31',
    justifyContent: 'center',
    padding: 22,
  },
  heroTablet: {
    minHeight: 240,
    padding: 28,
  },
  heroGlow: {
    position: 'absolute',
    right: -30,
    top: -40,
    width: 250,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(158,75,35,.22)',
  },
  heroCopy: {
    zIndex: 2,
    width: '70%',
  },
  kicker: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.17)',
    backgroundColor: 'rgba(15,14,24,.42)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  spark: {
    color: '#FFE1A1',
    fontSize: 12,
  },
  kickerText: {
    color: '#F2EAFB',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 28,
    marginTop: 10,
    lineHeight: 32,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#D1C9DC',
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 290,
  },
  heroPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  collectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.14)',
    backgroundColor: 'rgba(16,15,25,.42)',
  },
  collectionPillIcon: {
    fontSize: 11,
  },
  collectionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F1EDF7',
  },
  heroArt: {
    position: 'absolute',
    right: -4,
    bottom: -6,
    width: 155,
    height: 205,
    zIndex: 1,
  },
  heroTag: {
    position: 'absolute',
    right: 14,
    top: 14,
    backgroundColor: '#F1A5E7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    transform: [{ rotate: '4deg' }],
    borderRadius: 6,
  },
  heroTagText: {
    color: '#271B31',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  guideSurface: {
    padding: 16,
    backgroundColor: '#211D36',
  },
  guideLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  guideInfo: {
    flex: 1,
  },
  guideHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  guidePagination: {
    flexDirection: 'row',
    gap: 5,
  },
  guideDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  guideDotActive: {
    width: 16,
    backgroundColor: palette.violet,
  },
  guideTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  guideDesc: {
    color: '#C4B5FD',
    fontSize: 11,
    lineHeight: 16,
  },
  guideActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  guideActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: palette.violet,
    borderRadius: 8,
  },
  guideActionBtnText: {
    color: '#1E192D',
    fontSize: 10,
    fontWeight: '900',
  },
  guideNextBtn: {
    paddingVertical: 4,
  },
  guideNextBtnText: {
    color: palette.violetLight,
    fontSize: 10,
    fontWeight: '800',
  },
  guideImageWrap: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: 'rgba(167,139,250,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  guideImage: {
    width: '100%',
    height: '100%',
  },
  storage: {
    padding: 16,
    borderRadius: 18,
  },
  storageHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storageTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  storageNumbers: {
    color: '#AEBBD2',
    fontSize: 10.5,
    marginTop: 3,
  },
  storageIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(184,164,245,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 7,
    borderRadius: 10,
    backgroundColor: '#3A3D49',
    overflow: 'hidden',
    marginTop: 12,
  },
  trackFill: {
    height: 7,
    borderRadius: 10,
    backgroundColor: palette.violet,
  },
  storageFree: {
    color: '#9CB8E4',
    fontSize: 10,
    marginTop: 7,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  underlink: {
    color: '#CEC2FF',
    fontSize: 11,
    fontWeight: '800',
    textDecorationLine: 'underline',
    paddingBottom: 2,
  },
  volumeRail: {
    gap: 12,
    paddingRight: 8,
  },
  volumeCard: {
    width: 156,
    height: 184,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#2C263A',
    borderWidth: 1,
    borderColor: palette.border,
  },
  volumeArtwork: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#29243A',
  },
  chapterBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#A52226',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chapterBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  volumeTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  volumeAuthor: {
    color: '#D1C8DC',
    fontSize: 9.5,
    marginTop: 3,
  },
  emptyVolume: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#202334',
  },
  emptyVolumeIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(184,164,245,.12)',
  },
  emptyVolumeTitle: {
    color: '#F6F3FC',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyVolumeSub: {
    color: palette.muted,
    fontSize: 10.5,
    marginTop: 3,
  },
  arrow: {
    color: palette.violetLight,
    fontSize: 22,
  },
  collectionHeading: {
    fontSize: 20,
    marginTop: 4,
  },
  sectionSub: {
    color: '#8FA9D0',
    fontSize: 10.5,
    marginTop: 3,
  },
  refresh: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: palette.violetLight,
    fontSize: 20,
  },
  collectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: palette.border,
    flex: 1,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: palette.violet,
  },
  tabText: {
    color: palette.muted,
    fontWeight: '700',
    fontSize: 11.5,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tabCount: {
    color: palette.violetLight,
    fontSize: 9.5,
    fontWeight: '900',
  },
  search: {
    minHeight: 46,
    backgroundColor: '#222638',
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 13,
  },
  localActions: {
    gap: 8,
  },
  grid: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  gridRow: {
    marginBottom: 12,
  },
  gridCell: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  empty: {
    color: palette.muted,
    textAlign: 'center',
    fontSize: 12.5,
    lineHeight: 18,
    maxWidth: 320,
  },
  bookCard: {
    backgroundColor: '#202334',
    padding: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  bookCover: {
    width: '100%',
    height: 180,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: '#373047',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  bookCoverTablet: {
    height: 230,
  },
  coverArt: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  noCover: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#29243A',
    borderWidth: 1,
    borderColor: 'rgba(216,204,255,.08)',
  },
  noCoverFormat: {
    color: '#E5DFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  noCoverLabel: {
    color: '#AEB2C3',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  coverBadgeWrap: {
    margin: 6,
  },
  more: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,16,28,.78)',
  },
  moreText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  bookTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
    marginTop: 9,
    minHeight: 34,
    lineHeight: 17,
  },
  bookAuthor: {
    color: '#B8BDCE',
    fontSize: 9.5,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 4,
    backgroundColor: '#141722',
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 4,
    backgroundColor: palette.violet,
  },
  progressLabel: {
    color: '#9B9FB0',
    fontSize: 8.5,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  footerText: {
    color: '#858A9B',
    fontSize: 10,
    flex: 1,
  },
  signOut: {
    color: palette.violetLight,
    fontSize: 11,
    fontWeight: '800',
    padding: 6,
  },
  updateShade: {
    flex: 1,
    backgroundColor: 'rgba(5,6,11,.76)',
    justifyContent: 'center',
    padding: 22,
  },
  updateCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(216,204,255,.2)',
    backgroundColor: '#222638',
  },
  updateIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,.14)',
    marginBottom: 16,
  },
  updateTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 8,
  },
  updateCopy: {
    color: '#B8BDCE',
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 8,
  },
  updateLater: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  updateLaterText: {
    color: palette.violetLight,
    fontSize: 13,
    fontWeight: '800',
  },
  modalShade: {
    flex: 1,
    backgroundColor: 'rgba(5,6,11,.76)',
    justifyContent: 'center',
    padding: 22,
  },
  modal: {
    backgroundColor: '#222638',
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 4,
  },
  close: {
    color: palette.muted,
    fontSize: 28,
    paddingHorizontal: 6,
  },
  label: {
    color: '#D8DAE4',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#191D2B',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    borderColor: palette.border,
    borderWidth: 1,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 13,
  },
  deleteText: {
    color: '#FFB9B9',
    fontSize: 12,
    fontWeight: '800',
  },
});
