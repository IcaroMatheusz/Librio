import { useCallback, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Action, Heading, palette, Screen, Surface, useResponsiveLayout } from '../src/components/atoms';
import { WallpaperHero, wallpapers } from '../src/components/WallpaperHero';
import { changeAvatar, formatBytes, getProfile, saveProfile, type StorageInfo } from '../src/lib/account';
import { requireSupabase } from '../src/lib/supabase';

export default function ProfilePage() {
  const { isTablet, contentPadding, maxContentWidth } = useResponsiveLayout();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageInfo>({ used_bytes: 0, max_bytes: 104857600 });
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

  const percent = storage.max_bytes ? Math.min(100, (storage.used_bytes / storage.max_bytes) * 100) : 0;

  return (
    <Screen>
      <KeyboardAvoidingView style={s.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { maxWidth: maxContentWidth, paddingHorizontal: contentPadding }]}>
          <Action title="‹ Estante" quiet style={s.back} onPress={() => router.canGoBack() ? router.back() : router.replace('/library')} />
          <WallpaperHero source={wallpapers.profile} tall={isTablet} focalPoint={0.75}>
            <View style={s.identity}>
              <View style={s.avatar}>
                {avatar ? <Image source={{ uri: avatar }} style={s.photo} /> : <Text style={s.initial}>{(username || 'L').slice(0, 1).toUpperCase()}</Text>}
              </View>
              <View style={s.identityCopy}>
                <Heading style={s.title}>Editar perfil</Heading>
                {!!username && <Text numberOfLines={1} style={s.body}>{username}</Text>}
              </View>
            </View>
          </WallpaperHero>
          <View style={[s.sections, isTablet && s.wideSections]}>
            <Surface style={s.form}>
              <Text accessibilityRole="header" style={s.sectionTitle}>Dados da conta</Text>
              <Text style={s.label}>Nome de exibição</Text>
              <TextInput accessibilityLabel="Nome de exibição" style={s.input} value={username} onChangeText={setUsername} autoComplete="name" />
              <Text style={s.label}>E-mail</Text>
              <TextInput accessibilityLabel="E-mail" style={s.input} value={email} onChangeText={setEmail} autoComplete="email" keyboardType="email-address" autoCapitalize="none" />
              <Text style={s.label}>Nova senha (opcional)</Text>
              <TextInput accessibilityLabel="Nova senha" style={s.input} value={password} onChangeText={setPassword} autoComplete="new-password" secureTextEntry />
              <Action style={s.save} title={busy ? 'Aguarde…' : 'Salvar alterações'} disabled={busy} onPress={() => void save()} />
            </Surface>
            <View style={s.aside}>
              <Surface style={s.card}>
                <Action title="Alterar foto de perfil" quiet disabled={busy} onPress={() => void onAvatar()} />
              </Surface>
              <Surface style={s.card}>
                <Text accessibilityRole="header" style={s.sectionTitle}>Armazenamento na nuvem</Text>
                <Text style={s.body}>{formatBytes(storage.used_bytes)} de {formatBytes(storage.max_bytes)}</Text>
                <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}>
                  <View style={[s.fill, { width: `${percent}%` }]} />
                </View>
              </Surface>
              <Action title="Sair da conta" danger onPress={() => Alert.alert('Sair da conta?', undefined, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sair', style: 'destructive', onPress: () => void signOut() },
              ])} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  keyboard: { flex: 1 },
  content: { width: '100%', alignSelf: 'center', paddingTop: 10, paddingBottom: 30, gap: 16 },
  back: { alignSelf: 'flex-start' },
  title: { fontSize: 30 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  identityCopy: { flex: 1, gap: 2 },
  avatar: { width: 62, height: 62, borderRadius: 21, backgroundColor: palette.surfaceLight, borderColor: palette.borderLight, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  initial: { color: palette.violetLight, fontSize: 25, fontWeight: '900' },
  sections: { gap: 14 },
  wideSections: { flexDirection: 'row', alignItems: 'flex-start' },
  form: { flex: 1 },
  aside: { flex: 1, gap: 12 },
  card: { gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: palette.text },
  body: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  label: { color: palette.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 5 },
  input: { minHeight: 48, borderRadius: 12, paddingHorizontal: 12, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border, color: palette.text },
  save: { marginTop: 17 },
  track: { height: 5, borderRadius: 4, overflow: 'hidden', backgroundColor: palette.background },
  fill: { backgroundColor: palette.emerald, height: '100%' },
});
