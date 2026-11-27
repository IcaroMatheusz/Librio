import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Action,
  Badge,
  BookIcon,
  Brand,
  Heading,
  palette,
  Screen,
  Surface,
  useResponsiveLayout,
} from '../src/components/atoms';
import { getBooks } from '../src/lib/library';
import { requireSupabase } from '../src/lib/supabase';
import type { Book } from '../src/lib/types';

import { WallpaperHero } from '../src/components/WallpaperHero';
import { wallpapers } from '../src/config/wallpapers';

type Volume = {
  id: string;
  title: string;
  author: string;
  chapters: { book_id: string; chapter_number: number; title: string }[];
};

export default function Volumes() {
  const { isTablet, contentPadding, maxContentWidth } = useResponsiveLayout();

  const [books, setBooks] = useState<Book[]>([]);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const client = requireSupabase();
      const [bookList, vResult] = await Promise.all([
        getBooks(),
        client
          .from('book_volumes')
          .select('id,title,author')
          .order('created_at', { ascending: false }),
      ]);
      if (vResult.error) throw vResult.error;
      const ids = (vResult.data ?? []).map((v) => v.id);
      const cResult = ids.length
        ? await client
            .from('volume_chapters')
            .select('volume_id,book_id,chapter_number,title')
            .in('volume_id', ids)
            .order('chapter_number')
        : { data: [], error: null };
      if (cResult.error) throw cResult.error;

      setBooks(
        bookList.filter((b) =>
          ['pdf', 'cbr', 'cbz', 'epub'].includes(b.file_type.toLowerCase())
        )
      );
      setVolumes(
        (vResult.data ?? []).map((v) => ({
          ...v,
          chapters: (cResult.data ?? []).filter((c) => c.volume_id === v.id),
        }))
      );
    } catch (e) {
      Alert.alert(
        'Volumes indisponíveis',
        e instanceof Error ? e.message : 'Confira a configuração do Supabase.'
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function create() {
    if (selected.length < 2) {
      Alert.alert(
        'Selecione capítulos',
        'Um volume precisa ter pelo menos duas obras selecionadas.'
      );
      return;
    }
    if (!title.trim()) {
      Alert.alert(
        'Dê um nome ao volume',
        'Informe o título que será exibido na biblioteca.'
      );
      return;
    }
    setBusy(true);
    try {
      const client = requireSupabase();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error('Sua sessão expirou.');

      const { data: volume, error } = await client
        .from('book_volumes')
        .insert({
          user_id: user.id,
          title: title.trim(),
          author: author.trim(),
        })
        .select('id')
        .single();
      if (error) throw error;

      const chapters = selected.map((id, index) => ({
        volume_id: volume.id,
        book_id: id,
        chapter_number: index + 1,
        title: books.find((b) => b.id === id)?.title ?? `Capítulo ${index + 1}`,
      }));

      const { error: chapterError } = await client
        .from('volume_chapters')
        .insert(chapters);
      if (chapterError) {
        await client.from('book_volumes').delete().eq('id', volume.id);
        throw chapterError;
      }

      setTitle('');
      setAuthor('');
      setSelected([]);
      setCreating(false);
      await load();
    } catch (e) {
      Alert.alert(
        'Não foi possível criar o volume',
        e instanceof Error ? e.message : 'Tente novamente.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(volume: Volume) {
    if (volume.chapters.length) {
      Alert.alert(
        'Volume com obras vinculadas',
        'Para remover este volume, primeiro exclua as obras dos capítulos na biblioteca.'
      );
      return;
    }
    const { error } = await requireSupabase()
      .from('book_volumes')
      .delete()
      .eq('id', volume.id);
    if (error) Alert.alert('Não foi possível excluir', error.message);
    else void load();
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          s.page,
          {
            paddingHorizontal: contentPadding,
            maxWidth: maxContentWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Navigation Bar */}
        <View style={s.nav}>
          <Pressable onPress={() => router.replace('/library')}>
            <Brand />
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={s.back}>‹ Voltar à biblioteca</Text>
          </Pressable>
        </View>

        <WallpaperHero source={wallpapers.volumes} tall={isTablet}>
          <Heading style={s.bannerTitle}>Volumes</Heading>
          <Text style={s.bannerSubtitle}>Agrupe suas obras e escolha a ordem dos capítulos.</Text>
        </WallpaperHero>

        {/* Action Button */}
        <Action
          title={creating ? 'Fechar formulário de criação' : '＋ Montar um novo volume'}
          onPress={() => setCreating(!creating)}
          quiet
        />

        {/* Form Modal/Surface */}
        {creating && (
          <Animated.View entering={FadeInDown.duration(320)}>
            <Surface style={s.formSurface} glow>
              <Text style={s.formTitle}>Criar novo volume</Text>
              <Text style={s.formDesc}>
                Defina o nome da saga e selecione ao menos 2 obras da sua coleção para compor os capítulos.
              </Text>

              <Text style={s.label}>Título do volume</Text>
              <TextInput
                style={s.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Ex: Berserk - Era de Ouro"
                placeholderTextColor={palette.muted}
              />

              <Text style={s.label}>Autor / Roteirista (opcional)</Text>
              <TextInput
                style={s.input}
                value={author}
                onChangeText={setAuthor}
                placeholder="Ex: Kentaro Miura"
                placeholderTextColor={palette.muted}
              />

              <Text style={s.pickLabel}>
                Selecione as obras na ordem de leitura ({selected.length} selecionadas):
              </Text>

              {books.map((book) => {
                const isChecked = selected.includes(book.id);
                const orderIndex = selected.indexOf(book.id);
                return (
                  <Pressable
                    key={book.id}
                    style={[s.pickRow, isChecked && s.pickRowChecked]}
                    onPress={() =>
                      setSelected((prev) =>
                        prev.includes(book.id)
                          ? prev.filter((id) => id !== book.id)
                          : [...prev, book.id]
                      )
                    }
                  >
                    <View style={[s.checkbox, isChecked && s.checked]}>
                      {isChecked ? (
                        <Text style={s.checkText}>{orderIndex + 1}</Text>
                      ) : null}
                    </View>
                    <Text style={s.pickTitle} numberOfLines={1}>
                      {book.title}
                    </Text>
                    <Badge
                      label={book.file_type.toUpperCase()}
                      variant={
                        book.file_type.toLowerCase() === 'epub'
                          ? 'amber'
                          : book.file_type.toLowerCase() === 'pdf'
                          ? 'emerald'
                          : 'violet'
                      }
                    />
                  </Pressable>
                );
              })}

              <Action
                title={busy ? 'Criando volume…' : 'Salvar volume'}
                onPress={() => void create()}
                disabled={busy}
                style={{ marginTop: 16 }}
              />
            </Surface>
          </Animated.View>
        )}

        {/* Empty state */}
        {volumes.length === 0 && !creating && (
          <Surface style={s.emptySurface}>
            <View style={s.emptyIconWrap}>
              <BookIcon size={32} color={palette.violetLight} />
            </View>
            <Text style={s.emptyTitle}>Sua próxima saga começa aqui.</Text>
            <Text style={s.empty}>
              Agrupe PDFs, CBRs e CBZs em volumes e leia capítulo por capítulo sem sair do leitor.
            </Text>
          </Surface>
        )}

        {/* Existing Volumes */}
        {volumes.map((volume, index) => (
          <Animated.View
            key={volume.id}
            entering={FadeInDown.delay(index * 50).duration(320)}
          >
            <Surface style={s.volumeCard}>
              <View style={s.volumeTop}>
                <View style={s.volumeIconWrap}>
                  <BookIcon size={20} color={palette.violetLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.volumeTitle}>{volume.title}</Text>
                  <Text style={s.author}>
                    {volume.author || 'Autor não informado'} • {volume.chapters.length} capítulo(s)
                  </Text>
                </View>
                <Pressable
                  hitSlop={12}
                  onPress={() =>
                    Alert.alert(
                      'Excluir volume?',
                      volume.chapters.length
                        ? 'Exclua as obras dos capítulos na estante primeiro.'
                        : 'Este volume será removido.',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Excluir',
                          style: 'destructive',
                          onPress: () => void remove(volume),
                        },
                      ]
                    )
                  }
                >
                  <Text style={s.more}>•••</Text>
                </Pressable>
              </View>

              <View style={s.divider} />

              {volume.chapters.map((chapter) => {
                const book = books.find((b) => b.id === chapter.book_id);
                return (
                  <Pressable
                    key={chapter.book_id}
                    style={s.chapter}
                    onPress={() =>
                      book &&
                      router.push({
                        pathname: '/reader/[id]',
                        params: { id: book.id },
                      })
                    }
                  >
                    <View style={s.chapterNumberPill}>
                      <Text style={s.number}>
                        {String(chapter.chapter_number).padStart(2, '0')}
                      </Text>
                    </View>
                    <Text style={s.chapterTitle} numberOfLines={1}>
                      {chapter.title}
                    </Text>
                    {book && (
                      <Badge
                        label={book.file_type.toUpperCase()}
                        variant="neutral"
                      />
                    )}
                    <Text style={s.chevron}>›</Text>
                  </Pressable>
                );
              })}
            </Surface>
          </Animated.View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: {
    paddingTop: 10,
    paddingBottom: 40,
    gap: 16,
  },
  nav: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    color: palette.violetLight,
    fontWeight: '800',
    fontSize: 12,
  },
  bannerTitle: {
    fontSize: 26,
    lineHeight: 30,
    color: '#FFFFFF',
  },
  bannerSubtitle: {
    color: '#D2CBDE',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  formSurface: {
    padding: 20,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  formDesc: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  label: {
    color: '#D8DAE4',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 13,
  },
  pickLabel: {
    color: '#D3D5DF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderColor: palette.border,
  },
  pickRowChecked: {
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: '#666B7D',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: palette.violet,
    borderColor: palette.violet,
  },
  checkText: {
    color: '#1E192D',
    fontSize: 11,
    fontWeight: '900',
  },
  pickTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  emptySurface: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 17,
  },
  empty: {
    color: palette.muted,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  volumeCard: {
    padding: 16,
  },
  volumeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  volumeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  author: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 3,
  },
  more: {
    color: palette.violetLight,
    fontSize: 16,
    padding: 6,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 12,
  },
  chapter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  chapterNumberPill: {
    width: 28,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    color: palette.violetLight,
    fontSize: 11,
    fontWeight: '900',
  },
  chapterTitle: {
    color: '#E5E6ED',
    fontWeight: '700',
    fontSize: 12.5,
    flex: 1,
  },
  chevron: {
    fontSize: 20,
    color: palette.violetLight,
  },
});
