import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { palette } from '../src/components/atoms';
import { requireSupabase } from '../src/lib/supabase';
import { AuthNotice } from '../src/components/AuthNotice';
import { authFeedback, invalidEmail, validEmail, type AuthFeedback } from '../src/lib/authFeedback';

import { SafeAreaView } from 'react-native-safe-area-context';
import { wallpapers } from '../src/config/wallpapers';

const wallpaper = wallpapers.register;
const mascotIcon = require('../assets/librio-icon.png');

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!username.trim()) {
      setFeedback({ title: 'Informe seu nome', detail: 'Preencha o campo de nome completo para continuar.' });
      return;
    }
    if (!validEmail(email)) { setFeedback(invalidEmail); return; }
    if (password.length < 6) {
      setFeedback({ title: 'A senha está curta', detail: 'Use pelo menos 6 caracteres e evite senhas fáceis de adivinhar.' });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const { error } = await requireSupabase().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { username: username.trim() },
        },
      });
      if (error) throw error;
      setFeedback({ tone: 'success', title: 'Confira seu e-mail', detail: 'Se o endereço estiver disponível, você receberá um link para confirmar o cadastro. Se já tem conta, entre ou recupere sua senha.' });
    } catch (e) {
      setFeedback(authFeedback('register', e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ImageBackground source={wallpaper} resizeMode="cover" style={s.bg}>
      <View style={s.shade} />
      <SafeAreaView style={s.bgSafe}>
        <ScrollView
          contentContainerStyle={s.content}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.topbar}>
            <View style={s.logoWrapper}>
              <Image source={mascotIcon} style={s.logoImg} resizeMode="cover" />
            </View>
            <Text style={s.brand}>
              Librio<Text style={{ color: palette.violet }}>.</Text>
            </Text>
            <Pressable onPress={() => router.back()} style={s.back} hitSlop={12}>
              <Text style={s.link}>‹ Voltar ao login</Text>
            </Pressable>
          </View>

          <Animated.View entering={FadeInDown.duration(550)} style={s.card}>
            <Text style={s.title}>Crie sua conta</Text>
            <AuthNotice feedback={feedback} />

            <View style={s.fieldGroup}>
              <Text style={s.label}>Seu nome completo</Text>
              <TextInput
                style={s.input}
                value={username}
                onChangeText={(value) => { setUsername(value); setFeedback(null); }}
                placeholder="Ex: Clara Mendes"
                placeholderTextColor="#858BA0"
                autoCapitalize="words"
              />
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.label}>E-mail</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={(value) => { setEmail(value); setFeedback(null); }}
                placeholder="voce@email.com"
                placeholderTextColor="#858BA0"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.label}>Senha</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={(value) => { setPassword(value); setFeedback(null); }}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#858BA0"
                secureTextEntry
              />
            </View>

            <Pressable
              style={[s.button, busy && { opacity: 0.7 }]}
              onPress={() => void submit()}
              disabled={busy}
            >
              <Text style={s.buttonText}>
                {busy ? 'Criando conta…' : 'Criar minha conta  →'}
              </Text>
            </Pressable>

            <View style={s.footer}>
              <Text style={s.footerText}>Já tem uma conta? </Text>
              <Pressable onPress={() => router.replace('/')}>
                <Text style={s.linkStrong}>Fazer login</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bgSafe: { flex: 1 },
  bg: { flex: 1, overflow: 'hidden', backgroundColor: palette.background },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12, 10, 18, 0.67)',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 36,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  logoWrapper: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1.2,
    borderColor: 'rgba(167, 139, 250, 0.45)',
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  brand: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  back: {
    marginLeft: 'auto',
    padding: 6,
  },
  link: {
    color: '#E1D8FF',
    fontWeight: '700',
    fontSize: 12.5,
  },
  card: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(26, 22, 36, 0.96)',
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 6,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    color: '#E4E2EE',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(15, 17, 28, 0.65)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: '#FFFFFF',
    fontSize: 14,
  },
  button: {
    backgroundColor: palette.violet,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  buttonText: {
    color: '#1E192D',
    fontWeight: '900',
    fontSize: 14,
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
});
