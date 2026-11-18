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
import { Badge, palette } from '../src/components/atoms';
import { requireSupabase } from '../src/lib/supabase';

const wallpaper = require('../../assets/hellboy_wallpaper.jpg');
const mascotIcon = require('../../assets/librio-icon.png');

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!username.trim() || !email.trim() || !password) {
      setMessage('Por favor, preencha todos os campos.');
      return;
    }
    if (password.length < 6) {
      setMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const { error } = await requireSupabase().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { username: username.trim() },
        },
      });
      if (error) throw error;
      setMessage(
        'Conta criada com sucesso! Confira seu e-mail para confirmar seu cadastro.'
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Não foi possível criar a conta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ImageBackground source={wallpaper} resizeMode="cover" style={s.bg}>
      <View style={s.shade} />
      <ScrollView
        contentContainerStyle={s.content}
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
          <View style={s.badgeWrap}>
            <Badge label="NOVA CONTA" variant="violet" />
          </View>
          <Text style={s.title}>Crie sua conta</Text>
          <Text style={s.sub}>Uma estante digital para todas as suas histórias.</Text>

          <View style={s.fieldGroup}>
            <Text style={s.label}>Seu nome completo</Text>
            <TextInput
              style={s.input}
              value={username}
              onChangeText={setUsername}
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
              onChangeText={setEmail}
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
              onChangeText={setPassword}
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

          {!!message && (
            <Text
              style={[
                s.message,
                message.includes('sucesso') && s.messageSuccess,
              ]}
            >
              {message}
            </Text>
          )}

          <View style={s.footer}>
            <Text style={s.footerText}>Já tem uma conta? </Text>
            <Pressable onPress={() => router.replace('/')}>
              <Text style={s.linkStrong}>Fazer login</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: palette.background },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(13, 15, 25, 0.74)',
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
    backgroundColor: 'rgba(25, 28, 43, 0.94)',
  },
  badgeWrap: {
    marginBottom: 6,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 6,
  },
  sub: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 4,
    marginBottom: 16,
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
  message: {
    color: '#FFB9B9',
    lineHeight: 20,
    marginTop: 14,
    fontSize: 12.5,
    textAlign: 'center',
  },
  messageSuccess: {
    color: '#A7F3D0',
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
