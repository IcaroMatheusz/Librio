import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import type { Session } from '@supabase/supabase-js';
import { requireSupabase } from '../src/lib/supabase';
import { Badge, BookIcon, palette } from '../src/components/atoms';

const wallpaper = require('../../assets/onepiece_wallpaper.jpg');
const mascotIcon = require('../../assets/librio-icon.png');

export default function SignIn() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  useEffect(() => {
    try {
      const client = requireSupabase();
      client.auth.getSession().then(({ data }) => {
        setSession(data.session);
        if (data.session) router.replace('/library');
      });
      const { data } = client.auth.onAuthStateChange((_event, next) => {
        setSession(next);
        if (next) router.replace('/library');
      });
      return () => data.subscription.unsubscribe();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha na configuração do Supabase.');
    }
  }, []);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await requireSupabase().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  async function recover() {
    if (!recoveryEmail.trim()) {
      setRecoveryMessage('Informe seu e-mail para receber o link de recuperação.');
      return;
    }
    setRecoveryBusy(true);
    setRecoveryMessage('');
    try {
      const { error: resetError } = await requireSupabase().auth.resetPasswordForEmail(
        recoveryEmail.trim().toLowerCase(),
        { redirectTo: Linking.createURL('reset-password') }
      );
      if (resetError) throw resetError;
      setRecoveryMessage(
        'Solicitação enviada. Se este e-mail estiver cadastrado, você receberá as instruções para criar uma nova senha.'
      );
    } catch (caught) {
      setRecoveryMessage(
        caught instanceof Error
          ? `Não foi possível enviar: ${caught.message}`
          : 'Não foi possível enviar o e-mail. Tente novamente.'
      );
    } finally {
      setRecoveryBusy(false);
    }
  }

  if (session) {
    return (
      <View style={s.loading}>
        <Image source={mascotIcon} style={s.splashMascot} />
        <Text style={s.brand}>
          Librio<Text style={s.dot}>.</Text>
        </Text>
        <Text style={s.sub}>Carregando sua estante…</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={wallpaper} resizeMode="cover" style={s.background}>
      <View style={s.shade} />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Mascot & Logo */}
          <Animated.View entering={FadeInUp.duration(700)} style={s.brandBlock}>
            <View style={s.logoWrapper}>
              <Image source={mascotIcon} style={s.logoImg} resizeMode="cover" />
            </View>
            <Text style={s.brand}>
              Librio<Text style={s.dot}>.</Text>
            </Text>
            <Text style={s.tagline}>Sua próxima aventura começa aqui.</Text>
          </Animated.View>

          {/* Login Card */}
          <Animated.View
            entering={FadeInDown.delay(120).duration(600)}
            style={s.card}
          >
            <View style={s.badgeWrap}>
              <Badge label="SUA ESTANTE DIGITAL" variant="violet" />
            </View>
            <Text style={s.title}>Bem-vindo de volta</Text>
            <Text style={s.caption}>
              Entre e continue a leitura exatamente de onde parou.
            </Text>

            <Text style={s.label}>E-mail</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              placeholderTextColor="#777D92"
            />

            <Text style={s.label}>Senha</Text>
            <TextInput
              secureTextEntry
              autoComplete="password"
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Sua senha secreta"
              placeholderTextColor="#777D92"
              onSubmitEditing={() => void submit()}
            />

            <Pressable
              onPress={() => {
                setRecoveryMessage('');
                setRecoveryEmail(email);
                setRecoveryOpen(true);
              }}
              style={s.recover}
            >
              <Text style={s.link}>Esqueci minha senha</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                s.button,
                pressed && s.buttonPressed,
                busy && { opacity: 0.65 },
              ]}
              onPress={() => void submit()}
              disabled={busy}
            >
              <Text style={s.buttonText}>
                {busy ? 'Entrando na conta…' : 'Entrar na minha conta'}
                <Text style={s.arrow}> →</Text>
              </Text>
            </Pressable>

            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}

            <View style={s.footer}>
              <Text style={s.footerText}>Ainda não tem conta? </Text>
              <Pressable onPress={() => router.push('/register')}>
                <Text style={s.linkStrong}>Cadastre-se grátis</Text>
              </Pressable>
            </View>
          </Animated.View>

          <Text style={s.credit}>
            PDF • EPUB • CBR • CBZ • MANGÁ (RTL) • WEBTOON
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Recovery Modal */}
      <Modal
        visible={recoveryOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRecoveryOpen(false)}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.modalBackdrop}
        >
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(130)}
            style={s.recoveryCard}
          >
            <View style={s.badgeWrap}>
              <Badge label="RECUPERAÇÃO DE CONTA" variant="amber" />
            </View>
            <Text style={s.title}>Esqueceu sua senha?</Text>
            <Text style={s.caption}>
              Digite seu e-mail cadastrado e enviaremos o link seguro para redefinir sua senha.
            </Text>

            <Text style={s.label}>E-mail</Text>
            <TextInput
              style={s.recoveryInput}
              value={recoveryEmail}
              onChangeText={setRecoveryEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="voce@email.com"
              placeholderTextColor="#858BA0"
              returnKeyType="send"
              onSubmitEditing={() => void recover()}
            />

            {!!recoveryMessage && (
              <Text accessibilityRole="alert" style={s.recoveryMessage}>
                {recoveryMessage}
              </Text>
            )}

            <Pressable
              style={[s.button, recoveryBusy && { opacity: 0.65 }]}
              onPress={() => void recover()}
              disabled={recoveryBusy}
            >
              <Text style={s.buttonText}>
                {recoveryBusy ? (
                  <ActivityIndicator color="#211A34" />
                ) : (
                  'Enviar instruções'
                )}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setRecoveryOpen(false)}
              style={s.modalClose}
            >
              <Text style={s.link}>Voltar para o login</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </Modal>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  background: { flex: 1, backgroundColor: palette.background },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 17, 28, 0.72)',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 38,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: palette.violet,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  brand: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  dot: { color: palette.violet },
  tagline: {
    color: '#E2D9FC',
    fontSize: 13.5,
    marginTop: 3,
    fontWeight: '600',
  },
  card: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(27, 30, 46, 0.94)',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  badgeWrap: {
    marginBottom: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 6,
  },
  caption: {
    color: '#B8BDCE',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  label: {
    color: '#E6E4EF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(15, 17, 28, 0.65)',
    color: '#FFFFFF',
    fontSize: 14,
  },
  recover: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
  },
  link: {
    color: '#D2C5FF',
    fontSize: 12,
    fontWeight: '700',
  },
  button: {
    marginTop: 10,
    minHeight: 50,
    backgroundColor: palette.violet,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    backgroundColor: '#C8B8FF',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E192D',
  },
  arrow: { fontSize: 16 },
  error: {
    marginTop: 12,
    color: '#FFB3B3',
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#B8BDCE',
    fontSize: 12.5,
  },
  linkStrong: {
    color: '#E0D7FF',
    fontSize: 12.5,
    fontWeight: '900',
  },
  credit: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 24,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    gap: 8,
  },
  splashMascot: {
    width: 72,
    height: 72,
    borderRadius: 20,
    marginBottom: 8,
  },
  sub: {
    color: palette.muted,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 6, 11, 0.78)',
    justifyContent: 'center',
    padding: 20,
  },
  recoveryCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: '#222638',
  },
  recoveryMessage: {
    color: '#D8CCFF',
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 12,
  },
  recoveryInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: '#191D2B',
    color: '#FFFFFF',
    fontSize: 14,
  },
  modalClose: {
    alignItems: 'center',
    padding: 14,
  },
});
