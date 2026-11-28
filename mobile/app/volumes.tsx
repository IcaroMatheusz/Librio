import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Badge, BookIcon, Heading, Screen, Surface, useResponsiveLayout } from '../src/components/atoms';
import { AppSheet, useFeedback } from '../src/components/AppSheet';
import { FormField } from '../src/components/AccountForm';
import { LoadingIndicator } from '../src/components/Loading';
import { LibraryButton, LibraryIconButton, libraryInk, libraryType, useLibraryTheme } from '../src/design/libraryTheme';
import { getBookCoverUrl, getBooks } from '../src/lib/library';
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

  const { colors } = useLibraryTheme();
  const notify = useFeedback();
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');
  const [covers, setCovers] = useState<Record<string, string | null>>({});
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
      notify(
        'Volumes indisponíveis',
        e instanceof Error ? e.message : 'Confira a configuração do Supabase.'
      );
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let active = true;
    const ids = new Set(volumes.map(v => v.chapters[0]?.book_id));
    void Promise.all(books.filter(b => ids.has(b.id)).map(async book =>
      [book.id, await getBookCoverUrl(book).catch(() => null)] as const
    )).then(entries => { if (active) setCovers(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [books, volumes]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function create() {
    if (busy) return;
    setFormError('');
    if (selected.length < 2) {
      setFormError('Um volume precisa ter pelo menos duas obras selecionadas.');
      return;
    }
    if (!title.trim()) {
      setFormError('Informe o título que será exibido na biblioteca.');
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
      setFormError(e instanceof Error ? e.message : 'Não foi possível criar o volume. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(volume: Volume) {
    if (volume.chapters.length) {
      notify(
        'Volume com obras vinculadas',
        'Para remover este volume, primeiro exclua as obras dos capítulos na biblioteca.'
      );
      return;
    }
    const { error } = await requireSupabase()
      .from('book_volumes')
      .delete()
      .eq('id', volume.id);
    if (error) notify('Não foi possível excluir', error.message);
    else void load();
  }

  const back = () => router.canGoBack() ? router.back() : router.replace('/library');
  const closeForm = () => { if (!busy) setCreating(false); };
  return <Screen>
    <ScrollView contentContainerStyle={[s.page, { maxWidth: maxContentWidth, paddingHorizontal: contentPadding }]}>
      <View style={s.row}>
        <LibraryButton label="Biblioteca" icon="arrow-left" variant="quiet" onPress={back} />
      </View>
      <WallpaperHero source={wallpapers.volumes} tall={isTablet}>
        <Text style={[libraryType.title, { color: libraryInk.white }]}>Meus volumes<Text style={{ color: libraryInk.yellow }}>.</Text></Text>
        <Text style={[libraryType.body, { color: libraryInk.softOnHero }]}>Agrupe suas obras e escolha a ordem dos capítulos.</Text>
      </WallpaperHero>
      <View style={s.section}>
        <Text accessibilityRole="header" style={[libraryType.section, s.grow, { color: colors.text }]}>{loading ? 'Coleção' : volumes.length === 1 ? '1 volume' : `${volumes.length} volumes`}</Text>
        <LibraryButton label="Criar volume" icon="plus" onPress={() => { setFormError(''); setCreating(true); }} />
      </View>
      {loading ? <LoadingIndicator label="Carregando volumes…" /> : !volumes.length && <Surface style={s.empty}>
        <BookIcon size={30} /><Heading>Sua coleção de volumes</Heading>
        <Text style={[libraryType.body, s.center, { color: colors.secondary }]}>Escolha duas ou mais obras da estante para ler em sequência.</Text>
      </Surface>}
      {volumes.map(volume => {
        const cover = covers[volume.chapters[0]?.book_id];
        return <Surface key={volume.id} style={s.volume}>
          <View style={s.row}>
            <View style={[s.cover, { backgroundColor: colors.inset }]}>
              {cover ? <Image source={{ uri: cover }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : <BookIcon />}
            </View>
            <View style={s.grow}>
              <Text accessibilityRole="header" style={[libraryType.section, { color: colors.text }]}>{volume.title}</Text>
              <Text style={[libraryType.caption, { color: colors.muted }]}>{[volume.author, volume.chapters.length === 1 ? '1 capítulo' : volume.chapters.length + ' capítulos'].filter(Boolean).join(' · ')}</Text>
            </View>
            <LibraryIconButton icon="trash-2" label={`Excluir ${volume.title}`} onPress={() => volume.chapters.length
              ? void remove(volume)
              : notify('Excluir volume?', `“${volume.title}” será removido da sua coleção.`, { label: 'Excluir', run: () => void remove(volume) })} />
          </View>
          {volume.chapters.map(chapter => {
            const book = books.find(b => b.id === chapter.book_id);
            return <Pressable key={chapter.book_id} accessibilityRole="button" disabled={!book}
              onPress={() => book && router.push({ pathname: '/reader/[id]', params: { id: book.id, volume: volume.id } })}
              style={({ pressed }) => [s.chapter, { borderColor: colors.border }, pressed && s.pressed]}>
              <Text style={[libraryType.label, { color: colors.accent }]}>{String(chapter.chapter_number).padStart(2, '0')}</Text>
              <Text style={[libraryType.body, s.grow, { color: colors.text }]}>{chapter.title}</Text>
              {book && <Badge label={book.file_type.toUpperCase()} />}
            </Pressable>;
          })}
        </Surface>;
      })}
    </ScrollView>
    <AppSheet title="Criar volume" visible={creating} onClose={closeForm}>
      <FormField label="Título do volume" value={title} onChangeText={setTitle} placeholder="Nome da coleção" />
      <FormField label="Autor ou roteirista (opcional)" value={author} onChangeText={setAuthor} />
      <Text style={[libraryType.body, { color: colors.secondary }]}>Selecione ao menos duas obras na ordem de leitura.</Text>
      {books.map(book => {
        const order = selected.indexOf(book.id);
        return <Pressable key={book.id} accessibilityRole="checkbox" aria-checked={order >= 0} accessibilityState={{ checked: order >= 0 }} disabled={busy}
          accessibilityLabel={book.title} onPress={() => setSelected(current => current.includes(book.id) ? current.filter(id => id !== book.id) : [...current, book.id])}
          style={({ pressed }) => [s.pick, { backgroundColor: order >= 0 ? colors.accentSoft : colors.inset }, pressed && s.pressed]}>
          <View style={[s.number, { borderColor: order >= 0 ? colors.accent : colors.controlBorder }]}>
            {order >= 0 && <Text style={[libraryType.caption, { color: colors.accent }]}>{order + 1}</Text>}
          </View>
          <Text style={[libraryType.body, s.grow, { color: colors.text }]}>{book.title}</Text>
          <Badge label={book.file_type.toUpperCase()} />
        </Pressable>;
      })}
      {!!formError && <Text accessibilityLiveRegion="polite" style={[libraryType.body, { color: colors.danger }]}>{formError}</Text>}
      <LibraryButton label={busy ? 'Criando volume…' : 'Salvar volume'} icon="check" disabled={busy} onPress={() => void create()} />
    </AppSheet>
  </Screen>;
}

const s = StyleSheet.create({
  page: { alignSelf: 'center', width: '100%', gap: 14, paddingTop: 6, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, grow: { flex: 1 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8 }, empty: { alignItems: 'center', gap: 10, padding: 24 },
  center: { textAlign: 'center', maxWidth: 340 }, volume: { gap: 8 },
  cover: { width: 48, aspectRatio: 2 / 3, borderRadius: 5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  chapter: { minHeight: 44, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  pick: { minHeight: 44, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8 },
  number: { minWidth: 24, minHeight: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 6 },
  pressed: { opacity: 0.78 },
});
