import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, View, StyleSheet } from 'react-native';
import { FormScrollView } from '../src/components/FormScrollView';
import Animated, { FadeInDown, useReducedMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Lucide } from '@react-native-vector-icons/lucide';
import { IconButton } from '../src/components/IconButton';
import { LoadingIndicator, Skeleton, SkeletonBlock } from '../src/components/Loading';
import { useReaderSettings } from '../src/components/ReaderSettings';
import { router, useFocusEffect } from 'expo-router';
import { Action, Heading, Screen, useResponsiveLayout } from '../src/components/atoms';
import { useFeedback } from '../src/components/AppSheet';
import { FormField } from '../src/components/AccountForm';
import { libraryInk, themedStyles, useLibraryTheme } from '../src/design/libraryTheme';
import { WallpaperHero } from '../src/components/WallpaperHero';
import { wallpapers } from '../src/config/wallpapers';
import { changeAvatar, formatBytes, getProfile, saveProfile, type StorageInfo } from '../src/lib/account';
import { requireSupabase } from '../src/lib/supabase';

export default function ProfilePage() {
  const s = useStyles();
  const { colors } = useLibraryTheme();
  const reduced = useReducedMotion();
  const notify = useFeedback();
  const { isTablet, contentPadding, maxContentWidth } = useResponsiveLayout();
  const { fade, open: openPreferences } = useReaderSettings();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const revision = useRef(0);

  const load = useCallback(async () => {
    const request = ++revision.current;
    setLoadError('');
    try {
      const account = await getProfile();
      if (request !== revision.current) return;
      setUsername(account.profile.username);
      setAvatar(account.avatarUrl);
      setStorage(account.storage);
      setEmail(account.email);
      setLoaded(true);
    } catch {
      if (request === revision.current) setLoadError('Confira a conexão e tente carregar o perfil novamente.');
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { revision.current += 1; };
  }, [load]));

  async function save() {
    setBusy(true);
    try {
      await saveProfile(username, email, password);
      setPassword('');
      notify('Perfil atualizado', 'Se você alterou o e-mail, confirme a mudança pelo link enviado ao novo endereço.');
      await load();
    } catch (error) {
      notify('Não foi possível salvar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function onAvatar() {
    setBusy(true);
    try {
      await changeAvatar();
      await load();
    } catch (error) {
      notify('Não foi possível alterar a foto', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) notify('Não foi possível sair', error.message);
    else router.replace('/');
  }

  const percent = storage?.max_bytes ? Math.min(100, Math.max(0, storage.used_bytes / storage.max_bytes * 100)) : 0;
  const meter = useSharedValue(0);
  const fill = useAnimatedStyle(() => ({ width: `${meter.value}%` as `${number}%` }));
  useEffect(() => { meter.value = reduced ? percent : withTiming(percent, { duration: 200 }); }, [meter, percent, reduced]);

  return (
    <Screen>
        <FormScrollView contentContainerStyle={[s.content, { maxWidth: maxContentWidth, paddingHorizontal: contentPadding }]}>
          <View style={s.topBar}>
            <IconButton icon="arrow-left" label="Voltar à estante" onPress={() => router.canGoBack() ? router.back() : router.replace('/library')} />
            <Heading style={s.headerTitle}>Meu perfil</Heading>
          </View>

          <WallpaperHero source={wallpapers.profile} tall focalPoint={0.75}>
            {!loaded ? (
              <View style={s.identity}>
                <SkeletonBlock width={82} height={82} radius={41} />
                <View style={s.identityCopy}><SkeletonBlock width="66%" height={23} /><SkeletonBlock width="48%" height={12} /></View>
              </View>
            ) : <Animated.View entering={reduced ? undefined : FadeInDown.duration(180)} style={s.identity}>
              <Pressable accessibilityRole="button" accessibilityLabel="Alterar foto de perfil" disabled={busy}
                onPress={() => void onAvatar()} style={({ pressed }) => [s.avatarControl, pressed && s.avatarPressed]}>
                <View style={s.avatar}>
                  {avatar ? <Image source={{ uri: avatar }} style={s.photo} /> : <Text style={s.initial}>{(username || 'L').slice(0, 1).toUpperCase()}</Text>}
                </View>
                <View style={s.camera}><Lucide name="camera" color={colors.onAccent} size={16} accessible={false} /></View>
              </Pressable>
              <View style={s.identityCopy}>
                <Text style={s.name} numberOfLines={2}>{username.trim() || 'Seu perfil'}</Text>
                {!!email && <Text numberOfLines={1} style={[s.body, { color: libraryInk.softOnHero }]}>{email}</Text>}
              </View>
            </Animated.View>}
          </WallpaperHero>

          {!!loadError && (
            <View style={[s.card, s.loadingCard]} accessibilityLiveRegion="polite">
              <Text style={s.sectionTitle}>Perfil indisponível</Text>
              <Text style={s.body}>{loadError}</Text>
              <Action title="Tentar novamente" quiet onPress={() => void load()} />
            </View>
          )}
          {!loaded && !loadError && (
            <View style={[s.sections, isTablet && s.wideSections]}>
              <View style={[s.card, isTablet && s.mainCard]}>
                <Skeleton>
                  <LoadingIndicator label="Carregando perfil…" />
                  <SkeletonBlock width="55%" height={19} />
                  <SkeletonBlock height={48} radius={12} />
                  <SkeletonBlock width="38%" height={14} />
                  <SkeletonBlock height={48} radius={12} />
                  <SkeletonBlock height={48} radius={12} />
                </Skeleton>
              </View>
              <View style={[s.card, isTablet && s.flex]}>
                <Skeleton><SkeletonBlock width="66%" height={17} /><SkeletonBlock width="43%" height={21} /><SkeletonBlock height={6} /></Skeleton>
              </View>
            </View>
          )}
          {loaded && <View style={[s.sections, isTablet && s.wideSections]}>
            <Animated.View entering={reduced ? undefined : FadeInDown.duration(180)} style={[s.card, s.fields, isTablet && s.mainCard]}>
              <SectionHeading icon="circle-user-round" title="Dados da conta" />
              <FormField label="Nome de exibição" value={username} onChangeText={setUsername} autoComplete="name" />
              <FormField label="E-mail" value={email} onChangeText={setEmail} autoComplete="email"
                keyboardType="email-address" autoCapitalize="none" />
              <View style={s.divider} />
              <SectionHeading icon="lock-keyhole" title="Segurança" />
              <FormField label="Nova senha (opcional)" accessibilityLabel="Nova senha" value={password} onChangeText={setPassword} autoComplete="new-password"
                placeholder="Deixe em branco para manter" secureTextEntry />
              <Action style={s.save} title="Salvar alterações" disabled={busy} onPress={() => void save()} />
              {busy && <LoadingIndicator label="Atualizando o perfil…" />}
            </Animated.View>

            <View style={[s.aside, isTablet && s.flex]}>
              <Animated.View entering={reduced ? undefined : FadeInDown.duration(180)} style={s.card}>
                <SectionHeading icon="cloud" title="Armazenamento na nuvem" />
                {storage ? (
                  <>
                    <Text style={s.space}>{formatBytes(Math.max(0, storage.max_bytes - storage.used_bytes))} livres</Text>
                    <Text style={s.body}>{formatBytes(storage.used_bytes)} de {formatBytes(storage.max_bytes)} usados</Text>
                    <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}>
                      <Animated.View style={[s.fill, fill]} />
                    </View>
                  </>
                ) : <LoadingIndicator label="Carregando armazenamento…" />}
              </Animated.View>

              <Animated.View entering={reduced ? undefined : FadeInDown.duration(180)}>
                <Pressable accessibilityRole="button" accessibilityLabel="Preferências de leitura" onPress={openPreferences}
                  style={({ pressed }) => [s.card, s.preference, pressed && s.avatarPressed]}>
                  <View style={s.icon}><Lucide name="sliders-horizontal" color={colors.accent} size={19} accessible={false} /></View>
                  <View style={s.identityCopy}>
                    <Text style={s.sectionTitle}>Preferências de leitura</Text>
                    <Text style={s.body}>Esmaecimento {fade ? 'ativado' : 'desativado'}</Text>
                  </View>
                  <Lucide name="chevron-right" color={colors.muted} size={18} accessible={false} />
                </Pressable>
              </Animated.View>

              <Animated.View entering={reduced ? undefined : FadeInDown.duration(180)}>
                <Action title="Sair da conta" danger onPress={() => notify('Sair da conta?', 'Você poderá continuar lendo seus arquivos locais.', { label: 'Sair', run: () => void signOut() })} />
              </Animated.View>
            </View>
          </View>}
        </FormScrollView>
    </Screen>
  );
}

function SectionHeading({ title, icon }: { title: string; icon: 'circle-user-round' | 'lock-keyhole' | 'cloud' }) {
  const s = useStyles();
  const { colors } = useLibraryTheme();
  return (
    <View style={s.sectionHeading}>
      <View style={s.icon}><Lucide name={icon} color={colors.accent} size={18} accessible={false} /></View>
      <Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  flex: { flex: 1 },
  content: { width: '100%', alignSelf: 'center', paddingTop: 10, paddingBottom: 34, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  headerTitle: { fontSize: 24 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  identityCopy: { flex: 1, gap: 3 },
  avatarControl: { position: 'relative' },
  avatarPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.raised, borderWidth: 3, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  initial: { color: colors.accent, fontSize: 32, fontWeight: '900' },
  camera: { position: 'absolute', right: -2, bottom: -1, borderRadius: 17, width: 32, height: 32, borderWidth: 2, borderColor: colors.raised,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  name: { color: libraryInk.white, fontSize: 25, fontWeight: '900', lineHeight: 30 },
  sections: { gap: 14 },
  wideSections: { flexDirection: 'row', alignItems: 'flex-start' },
  mainCard: { flex: 1.2 },
  aside: { gap: 12 },
  card: { padding: 16, borderRadius: 12, backgroundColor: colors.surface },
  loadingCard: { gap: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { alignItems: 'center', justifyContent: 'center', width: 39, height: 39, borderRadius: 12, backgroundColor: colors.accentSoft },
  sectionTitle: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  fields: { gap: 10 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  save: { marginTop: 4 },
  space: { color: colors.progress, fontSize: 21, fontWeight: '900', marginTop: 12 },
  track: { height: 6, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.inset, marginTop: 10 },
  fill: { backgroundColor: colors.progress, height: '100%' },
  preference: { flexDirection: 'row', alignItems: 'center', gap: 9 },
}));
