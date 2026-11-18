import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
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
  Eyebrow,
  Heading,
  palette,
  Screen,
  Surface,
  useResponsiveLayout,
} from '../src/components/atoms';
import {
  changeAvatar,
  formatBytes,
  getProfile,
  saveProfile,
  type Profile,
  type StorageInfo,
} from '../src/lib/account';
import { requireSupabase } from '../src/lib/supabase';

const wallpaper = require('../assets/hellboy_wallpaper.jpg');

export default function ProfilePage() {
  const { isTablet, contentPadding, maxContentWidth } = useResponsiveLayout();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageInfo>({
    used_bytes: 0,
    max_bytes: 104857600,
  });
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getProfile();
      setProfile(result.profile);
      setUsername(result.profile.username);
      setAvatar(result.avatarUrl);
      setStorage(result.storage);
      const {
        data: { user },
      } = await requireSupabase().auth.getUser();
      setEmail(user?.email ?? '');
    } catch (e) {
      Alert.alert(
        'Perfil indisponível',
        e instanceof Error ? e.message : 'Tente novamente.'
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const percent = storage.max_bytes
    ? Math.min(100, (storage.used_bytes / storage.max_bytes) * 100)
    : 0;

  async function save() {
    setBusy(true);
    try {
      await saveProfile(username, email, password);
      setPassword('');
      Alert.alert(
        'Perfil atualizado',
        'As alterações foram salvas. Se você alterou o e-mail, confirme no link enviado para o novo endereço.'
      );
      await load();
    } catch (e) {
      Alert.alert(
        'Não foi possível salvar',
        e instanceof Error ? e.message : 'Tente novamente.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function onAvatar() {
    setBusy(true);
    try {
      await changeAvatar();
      await load();
    } catch (e) {
      Alert.alert(
        'Não foi possível alterar a foto',
        e instanceof Error ? e.message : 'Tente novamente.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await requireSupabase().auth.signOut();
    router.replace('/');
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          s.content,
          {
            paddingHorizontal: contentPadding,
            maxWidth: maxContentWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Navigation Topbar */}
        <View style={s.topbar}>
          <Pressable onPress={() => router.replace('/library')}>
            <Brand showBadge />
          </Pressable>
          <Pressable onPress={() => router.replace('/library')} hitSlop={12}>
            <Text style={s.back}>‹ Voltar à biblioteca</Text>
          </Pressable>
        </View>

        {/* Hero Profile Banner */}
        <ImageBackground
          source={wallpaper}
          imageStyle={{ borderRadius: 24, opacity: 0.55 }}
          style={[s.banner, isTablet && s.bannerTablet]}
        >
          <View style={s.bannerOverlay} />
          <View style={s.bannerContent}>
            <View style={s.badgeWrap}>
              <Badge label="CONTA E PREFERÊNCIAS" variant="violet" />
            </View>
            <Heading style={s.bannerTitle}>Seu Perfil</Heading>
            <Text style={s.bannerSubtitle}>
              Personalize sua identidade e gerencie o espaço de leitura da sua conta.
            </Text>
          </View>
          <View style={s.bannerIcon}>
            <BookIcon size={24} color={palette.violetLight} />
          </View>
        </ImageBackground>

        {/* Identity & Avatar Card */}
        <Animated.View entering={FadeInDown.duration(420)}>
          <Surface style={s.profileCard} glow>
            <View style={s.identity}>
              <View style={s.avatarContainer}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={s.avatar} />
                ) : (
                  <View style={s.avatarFallback}>
                    <Text style={s.avatarLetter}>
                      {(username || 'L').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={s.avatarRing} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.name}>{profile?.username || 'Leitor Librio'}</Text>
                <Text style={s.emailLabel}>{email}</Text>
                <View style={s.memberBadgeRow}>
                  <Badge label="MEMBRO LIBRIO" variant="violet" />
                </View>
              </View>

              <Action
                title="Mudar foto"
                quiet
                onPress={() => void onAvatar()}
                disabled={busy}
              />
            </View>
          </Surface>
        </Animated.View>

        {/* Storage Card */}
        <Surface style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.sectionTitle}>Armazenamento na nuvem</Text>
            <Badge label={`${percent.toFixed(0)}% OCUPADO`} variant="amber" />
          </View>
          <View style={s.storageNums}>
            <Text style={s.storageUsed}>{formatBytes(storage.used_bytes)}</Text>
            <Text style={s.storageMax}>de {formatBytes(storage.max_bytes)}</Text>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { width: `${percent}%` }]} />
          </View>
          <Text style={s.storageFoot}>
            {formatBytes(Math.max(0, storage.max_bytes - storage.used_bytes))} disponíveis para novos livros e quadrinhos.
          </Text>
        </Surface>

        {/* Account Edit Form */}
        <Surface style={s.card}>
          <Text style={s.sectionTitle}>Dados da conta</Text>
          <Text style={s.cardDesc}>
            Atualize seu nome de exibição, e-mail de acesso ou redefina sua senha.
          </Text>

          <Text style={s.label}>Nome de usuário</Text>
          <TextInput
            style={s.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Seu nome completo"
            placeholderTextColor={palette.muted}
          />

          <Text style={s.label}>E-mail</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="seu@email.com"
            placeholderTextColor={palette.muted}
          />

          <Text style={s.label}>
            Nova senha <Text style={s.optional}>(opcional - deixe em branco para manter)</Text>
          </Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••••••"
            placeholderTextColor={palette.muted}
          />

          <Action
            title={busy ? 'Salvando dados…' : 'Salvar alterações'}
            onPress={() => void save()}
            disabled={busy}
            style={{ marginTop: 20 }}
          />
        </Surface>

        {/* Sagas Quicklink */}
        <Surface style={s.links}>
          <Pressable onPress={() => router.push('/volumes')} style={s.linkRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.linkText}>▤ Organizar volumes e sagas</Text>
              <Text style={s.linkSub}>Agrupe capítulos em volumes na estante</Text>
            </View>
            <Text style={s.arrow}>→</Text>
          </Pressable>
        </Surface>

        {/* Sign Out Button */}
        <Action
          title="Sair da conta"
          danger
          onPress={() =>
            Alert.alert('Sair do Librio?', 'Você pode entrar novamente quando quiser.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sair', style: 'destructive', onPress: () => void signOut() },
            ])
          }
          style={{ marginBottom: 20 }}
        />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: {
    paddingTop: 4,
    paddingBottom: 40,
    gap: 16,
  },
  topbar: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    color: palette.violetLight,
    fontSize: 12.5,
    fontWeight: '800',
  },
  banner: {
    height: 165,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: '#2A1D30',
    borderWidth: 1,
    borderColor: 'rgba(216,204,255,.2)',
  },
  bannerTablet: {
    height: 195,
    padding: 26,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(16,14,25,.55)',
  },
  bannerContent: {
    zIndex: 1,
    maxWidth: '80%',
  },
  badgeWrap: {
    marginBottom: 6,
  },
  bannerTitle: {
    fontSize: 27,
    lineHeight: 31,
    color: '#FFFFFF',
  },
  bannerSubtitle: {
    color: '#D2CBDE',
    fontSize: 12,
    marginTop: 4,
  },
  bannerIcon: {
    position: 'absolute',
    right: 18,
    top: 18,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(20,17,31,.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(216,204,255,.25)',
  },
  profileCard: {
    padding: 16,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: palette.panelLight,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#3B3550',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: palette.violetLight,
  },
  avatarLetter: {
    color: palette.violetLight,
    fontSize: 25,
    fontWeight: '900',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  emailLabel: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2,
  },
  memberBadgeRow: {
    marginTop: 6,
  },
  card: {
    padding: 18,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDesc: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  storageNums: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 14,
  },
  storageUsed: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  storageMax: {
    color: palette.muted,
    fontSize: 12.5,
  },
  track: {
    height: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#111420',
    marginTop: 10,
  },
  fill: {
    height: 8,
    borderRadius: 10,
    backgroundColor: palette.violet,
  },
  storageFoot: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 8,
  },
  label: {
    color: '#D8DAE4',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 14,
    marginBottom: 6,
  },
  optional: {
    color: palette.mutedDark,
    fontWeight: '500',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#191D2B',
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 13,
  },
  links: {
    padding: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  linkText: {
    color: '#F0EEFA',
    fontWeight: '800',
    fontSize: 13.5,
  },
  linkSub: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 2,
  },
  arrow: {
    color: palette.violetLight,
    fontSize: 18,
    fontWeight: '900',
  },
});
