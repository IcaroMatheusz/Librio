import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { libraryGradients, libraryInk, LibraryIconButton, LibraryProgress, useLibraryTheme } from '../design/libraryTheme';
import { wallpapers, wallpaperAssets } from '../config/wallpapers';
import { nativeMedia } from '../lib/nativeMedia';

export function LibraryMasthead({ count, loading, tablet }: { count: number; loading: boolean; tablet: boolean }) {
  const illustration = wallpapers.library === wallpaperAssets.spawnReading;
  return (
    <View style={[s.banner, { minHeight: tablet ? 176 : 148, backgroundColor: libraryInk.hero, backgroundImage: libraryGradients.hero }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image accessible={false} source={wallpapers.library} resizeMode={illustration ? 'contain' : 'cover'}
          style={illustration ? s.figure : s.wallpaper} />
        <View style={[StyleSheet.absoluteFill, { backgroundImage: libraryGradients.heroShade }]} />
      </View>
      <View style={s.bannerCopy}>
        <Text accessibilityRole="header" style={[s.bannerTitle, { color: libraryInk.white }]}>Minha estante<Text style={{ color: libraryInk.yellow }}>.</Text></Text>
        <View style={s.collectionCount}>
          <Lucide name="library-big" size={15} color={libraryInk.yellow} accessible={false} />
          <Text style={[s.bannerCaption, { color: libraryInk.softOnHero }]}>{loading ? 'Carregando acervo…' : count === 1 ? '1 obra no acervo' : `${count} obras no acervo`}</Text>
        </View>
      </View>
    </View>
  );
}

function Cover({ uri, title, small = false }: { uri?: string; title: string; small?: boolean }) {
  const [failed, setFailed] = useState<string>();
  if (uri && uri !== failed) return <Image accessible={false} source={{ uri }} resizeMode="cover" onError={() => setFailed(uri)} style={s.wallpaper} />;
  return (
    <View style={[s.coverFallback, { backgroundImage: libraryGradients.cover, backgroundColor: libraryInk.hero }]}>
      <Lucide name="book-open" size={small ? 20 : 30} color={libraryInk.softOnHero} accessible={false} />
      {!small && <Text numberOfLines={3} style={[s.coverName, { color: libraryInk.white }]}>{title}</Text>}
    </View>
  );
}

type BookArt = { title: string; cover?: string; detail?: string; format: string };

export function LibraryBookCard({ book, width, progress, read, edit }: {
  book: BookArt; width: number; progress?: number; read: () => void; edit: () => void;
}) {
  const { colors } = useLibraryTheme();
  return (
    <View style={{ width }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ler ${book.title}`} accessibilityHint="Mantenha pressionado para editar"
        onPress={read} onLongPress={() => { nativeMedia?.contextMenuHaptic?.(); edit(); }}
        style={({ pressed }) => [s.thumbnail, { backgroundColor: colors.inset }, pressed && s.pressed]}>
        <Cover uri={book.cover} title={book.title} />
        <View style={[s.format, { backgroundColor: libraryInk.formatBackdrop }]}>
          <Text style={[s.formatText, { color: libraryInk.white }]}>{book.format.toUpperCase()}</Text>
        </View>
      </Pressable>
      <View style={s.caption}>
        <Pressable onPress={read} accessible={false} style={s.captionText}>
          <Text numberOfLines={2} style={[s.bookTitle, { color: colors.text }]}>{book.title}</Text>
          {!!book.detail && <Text numberOfLines={1} style={[s.detail, { color: colors.muted }]}>{book.detail}</Text>}
        </Pressable>
        <LibraryIconButton icon="ellipsis" label={`Editar ${book.title}`} onPress={edit} size={17} />
      </View>
      {!!progress && <LibraryProgress value={progress} label={`Progresso de ${book.title}`} />}
    </View>
  );
}

export function ReadingCard({ book, percent, local, width, read, dismiss }: {
  book: BookArt; percent: number; local: boolean; width: number; read: () => void; dismiss: () => void;
}) {
  const { colors, mode } = useLibraryTheme();
  const dark = mode === 'dark';
  return (
    <View style={[s.readingCard, { width, backgroundColor: colors.surface, backgroundImage: dark ? libraryGradients.feature : libraryGradients.featureLight }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Continuar ${book.title}`}
        onPress={read} style={({ pressed }) => [s.readingAction, pressed && s.pressed]}>
        <View style={[s.readingCover, { backgroundColor: colors.inset }]}><Cover uri={book.cover} title={book.title} small /></View>
        <View style={s.readingInfo}>
          <Text style={[s.formatLine, { color: colors.secondary }]}>{book.format.toUpperCase()} · {local ? 'No aparelho' : 'Nuvem'}</Text>
          <Text numberOfLines={2} style={[s.readingTitle, { color: colors.text }]}>{book.title}</Text>
          <View style={s.readingProgress}>
            <View style={s.readingLine}><LibraryProgress value={percent} label={`Leitura de ${book.title}`} /></View>
            <Text style={[s.percent, { color: colors.secondary }]}>{percent}%</Text>
          </View>
          <View style={s.readingLink}>
            <Text style={[s.linkText, { color: colors.accent }]}>Continuar leitura</Text>
            <Lucide name="arrow-right" size={15} color={colors.accent} accessible={false} />
          </View>
        </View>
      </Pressable>
      <LibraryIconButton icon="x" label={`Remover ${book.title} de Continuar lendo`} onPress={dismiss} size={15} style={s.dismiss} />
    </View>
  );
}

const s = StyleSheet.create({
  banner: { overflow: 'hidden', borderRadius: 14, justifyContent: 'center' },
  figure: { position: 'absolute', right: '-5%', top: '-33%', width: '65%', height: '180%' },
  wallpaper: { width: '100%', height: '100%' },
  bannerCopy: { width: '65%', maxWidth: 430, paddingHorizontal: 18, paddingVertical: 17, gap: 10 },
  bannerTitle: { fontSize: 34, lineHeight: 37, fontWeight: '900', letterSpacing: -1.5 },
  collectionCount: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerCaption: { flexShrink: 1, fontSize: 13, fontWeight: '600' },
  thumbnail: { aspectRatio: 2 / 3, overflow: 'hidden', borderRadius: 8 },
  coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 10 },
  coverName: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  format: { position: 'absolute', left: 7, bottom: 7, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  formatText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  caption: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 3 },
  captionText: { flex: 1, paddingTop: 6, paddingBottom: 6, gap: 3 },
  bookTitle: { fontSize: 15, lineHeight: 19, fontWeight: '700', letterSpacing: -0.25 },
  detail: { fontSize: 12, lineHeight: 17 },
  readingCard: { borderRadius: 12, overflow: 'hidden' },
  readingAction: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 14, flex: 1 },
  readingCover: { width: '27%', maxWidth: 95, aspectRatio: 2 / 3, borderRadius: 5, overflow: 'hidden' },
  readingInfo: { flex: 1, gap: 5 },
  formatLine: { fontWeight: '600', fontSize: 11, paddingRight: 23 },
  readingTitle: { fontSize: 19, lineHeight: 23, letterSpacing: -0.45, fontWeight: '800', paddingRight: 6 },
  readingProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  readingLine: { flex: 1 },
  percent: { fontVariant: ['tabular-nums'], fontSize: 11, fontWeight: '700' },
  readingLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  linkText: { fontSize: 13, fontWeight: '700' },
  dismiss: { position: 'absolute', right: 0, top: 0 },
  pressed: { opacity: 0.8 },
});
