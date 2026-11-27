import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Lucide } from '@react-native-vector-icons/lucide';
import { IconButton } from '../src/components/IconButton';
import { useReaderSettings } from '../src/components/ReaderSettings';
import { router, useFocusEffect } from 'expo-router';
import { Action, Heading, palette, Screen, useResponsiveLayout } from '../src/components/atoms';
import { WallpaperHero } from '../src/components/WallpaperHero';
import { wallpapers } from '../src/config/wallpapers';
import { changeAvatar, formatBytes, getProfile, saveProfile, type StorageInfo } from '../src/lib/account';
import { requireSupabase } from '../src/lib/supabase';

export default function ProfilePage() {
  const { isTablet, contentPadding, maxContentWidth } = useResponsiveLayout();
  const { fade, open: openPreferences } = useReaderSettings();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [account, { data: { user } }] = await Promise.all([getProfile(), requireSupabase().auth.getUser()]);
      setUsername(account.profile.username);
      setAvatar(account.avatarUrl);
      setStorage(account.storage);
      setEmail(user?.email ?? '');
    } catch (error) {
      Alert.alert('Perfil indisponível', error instanceof Error ? error.message : 'Tente novamente.');
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function save() {
    setBusy(true);
    try {
      await saveProfile(username, email, password);
      setPassword('');
      Alert.alert('Perfil atualizado', 'Se você alterou o e-mail, confirme a mudança pelo link enviado ao novo endereço.');
      await load();
    } catch (error) {
      Alert.alert('Não foi possível salvar', error instanceof Error ? error.message : 'Tente novamente.');
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
      Alert.alert('Não foi possível alterar a foto', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) Alert.alert('Não foi possível sair', error.message);
    else router.replace('/');
  }

  const percent = storage?.max_bytes ? Math.min(100, Math.max(0, storage.used_bytes / storage.max_bytes * 100)) : 0;
  const meter = useSharedValue(0);
  const fill = useAnimatedStyle(() => ({ width: `${meter.value}%` as `${number}%` }));
  useEffect(() => { meter.value = withTiming(percent, { duration: 430 }); }, [meter, percent]);

  return (
    <Screen>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { maxWidth: maxContentWidth, paddingHorizontal: contentPadding }]}>
          <View style={s.topBar}>
            <IconButton icon="arrow-left" label="Voltar à estante" onPress={() => router.canGoBack() ? router.back() : router.replace('/library')} />
            <Heading style={s.headerTitle}>Meu perfil</Heading>
          </View>

          <WallpaperHero source={wallpapers.profile} tall focalPoint={0.75}>
            <Animated.View entering={FadeInDown.duration(340).delay(90)} style={s.identity}>
              <Pressable accessibilityRole="button" accessibilityLabel="Alterar foto de perfil" disabled={busy}
                onPress={() => void onAvatar()} style={({ pressed }) => [s.avatarControl, pressed && s.avatarPressed]}>
                <View style={s.avatar}>
                  {avatar ? <Image source={{ uri: avatar }} style={s.photo} /> : <Text style={s.initial}>{(username || 'L').slice(0, 1).toUpperCase()}</Text>}
                </View>
                <View style={s.camera}><Lucide name="camera" color={palette.onAccent} size={16} accessible={false} /></View>
              </Pressable>
              <View style={s.identityCopy}>
                <Text style={s.name} numberOfLines={2}>{username.trim() || 'Seu perfil'}</Text>
                {!!email && <Text numberOfLines={1} style={s.body}>{email}</Text>}
              </View>
            </Animated.View>
          </WallpaperHero>

          <View style={[s.sections, isTablet && s.wideSections]}>
            <Animated.View entering={FadeInDown.duration(350).delay(140)} style={[s.card, isTablet && s.mainCard]}>
              <SectionHeading icon="circle-user-round" title="Dados da conta" />
              <Text style={s.label}>Nome de exibição</Text>
              <TextInput accessibilityLabel="Nome de exibição" style={s.input} value={username} onChangeText={setUsername} autoComplete="name" />
              <Text style={s.label}>E-mail</Text>
              <TextInput accessibilityLabel="E-mail" style={s.input} value={email} onChangeText={setEmail} autoComplete="email"
                keyboardType="email-address" autoCapitalize="none" />
              <View style={s.divider} />
              <SectionHeading icon="lock-keyhole" title="Segurança" />
              <Text style={s.label}>Nova senha (opcional)</Text>
              <TextInput accessibilityLabel="Nova senha" style={s.input} value={password} onChangeText={setPassword} autoComplete="new-password"
                placeholder="Deixe em branco para manter" placeholderTextColor={palette.mutedDark} secureTextEntry />
              <Action style={s.save} title={busy ? 'Aguarde…' : 'Salvar alterações'} disabled={busy} onPress={() => void save()} />
            </Animated.View>

            <View style={[s.aside, isTablet && s.flex]}>
              <Animated.View entering={FadeInDown.duration(350).delay(200)} style={s.card}>
                <SectionHeading icon="cloud" title="Armazenamento na nuvem" />
                {storage ? (
                  <>
                    <Text style={s.space}>{formatBytes(Math.max(0, storage.max_bytes - storage.used_bytes))} livres</Text>
                    <Text style={s.body}>{formatBytes(storage.used_bytes)} de {formatBytes(storage.max_bytes)} usados</Text>
                    <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}>
                      <Animated.View style={[s.fill, fill]} />
                    </View>
                  </>
                ) : <Text style={s.body}>Carregando a cota da conta…</Text>}
              </Animated.View>

              <Animated.View entering={FadeInDown.duration(350).delay(245)}>
                <Pressable accessibilityRole="button" accessibilityLabel="Preferências de leitura" onPress={openPreferences}
                  style={({ pressed }) => [s.card, s.preference, pressed && s.avatarPressed]}>
                  <View style={s.icon}><Lucide name="sliders-horizontal" color={palette.violet} size={19} accessible={false} /></View>
                  <View style={s.identityCopy}>
                    <Text style={s.sectionTitle}>Preferências de leitura</Text>
                    <Text style={s.body}>Esmaecimento {fade ? 'ativado' : 'desativado'}</Text>
                  </View>
                  <Lucide name="chevron-right" color={palette.muted} size={18} accessible={false} />
                </Pressable>
              </Animated.View>

              <Animated.View entering={FadeInDown.duration(350).delay(285)}>
                <Action title="Sair da conta" danger onPress={() => Alert.alert('Sair da conta?', undefined, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Sair', style: 'destructive', onPress: () => void signOut() },
                ])} />
              </Animated.View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function SectionHeading({ title, icon }: { title: string; icon: 'circle-user-round' | 'lock-keyhole' | 'cloud' }) {
  return (
    <View style={s.sectionHeading}>
      <View style={s.icon}><Lucide name={icon} color={palette.violet} size={18} accessible={false} /></View>
      <Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { width: '100%', alignSelf: 'center', paddingTop: 10, paddingBottom: 34, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  headerTitle: { fontSize: 24 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  identityCopy: { flex: 1, gap: 3 },
  avatarControl: { position: 'relative' },
  avatarPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: palette.card, borderWidth: 3, borderColor: palette.violet,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  initial: { color: palette.violetLight, fontSize: 32, fontWeight: '900' },
  camera: { position: 'absolute', right: -2, bottom: -1, borderRadius: 17, width: 32, height: 32, borderWidth: 2, borderColor: palette.card,
    backgroundColor: palette.violet, alignItems: 'center', justifyContent: 'center' },
  name: { color: palette.text, fontSize: 25, fontWeight: '900', lineHeight: 30 },
  sections: { gap: 14 },
  wideSections: { flexDirection: 'row', alignItems: 'flex-start' },
  mainCard: { flex: 1.2 },
  aside: { gap: 12 },
  card: { padding: 17, borderWidth: 1, borderColor: palette.border, borderRadius: 20, backgroundColor: palette.surface },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { alignItems: 'center', justifyContent: 'center', width: 39, height: 39, borderRadius: 12, backgroundColor: palette.violetGlow },
  sectionTitle: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: palette.text },
  body: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  label: { color: palette.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: palette.input, borderWidth: 1, borderColor: palette.border, color: palette.text },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: 16 },
  save: { marginTop: 17 },
  space: { color: palette.emerald, fontSize: 21, fontWeight: '900', marginTop: 12 },
  track: { height: 6, borderRadius: 6, overflow: 'hidden', backgroundColor: palette.input, marginTop: 10 },
  fill: { backgroundColor: palette.emerald, height: '100%' },
  preference: { flexDirection: 'row', alignItems: 'center', gap: 9 },
});
