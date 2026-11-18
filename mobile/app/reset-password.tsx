import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Badge, palette } from '../src/components/atoms';
import { requireSupabase } from '../src/lib/supabase';

const wallpaper = require('../assets/onepiece_wallpaper.jpg');

export default function ResetPassword() {
  const { code, token_hash } = useLocalSearchParams<{
    code?: string;
    token_hash?: string;
  }>();
  const [password, setPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Validando o link de recuperação…');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const client = requireSupabase();
        let exchangeError: Error | null = null;
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          exchangeError = error;
        } else if (token_hash) {
          const { error } = await client.auth.verifyOtp({
            token_hash,
            type: 'recovery',
          });
          exchangeError = error;
        } else {
          const incoming = await Linking.getInitialURL();
          const fragment = incoming?.split('#')[1];
          if (fragment) {
            const params = new URLSearchParams(fragment);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            if (access_token && refresh_token) {
              const { error } = await client.auth.setSession({
                access_token,
                refresh_token,
              });
              exchangeError = error;
            }
          }
        }
        if (exchangeError) throw exchangeError;
        const { data } = await client.auth.getSession();
        if (!data.session) {
          throw new Error(
            'Este link expirou. Solicite uma nova recuperação de senha na tela de login.'
          );
        }
        if (active) {
          setReady(true);
          setMessage('Escolha uma nova senha para sua conta Librio.');
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Não foi possível validar o link de recuperação.'
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [code, token_hash]);

  async function save() {
    if (password.length < 6) {
      setMessage('Use uma senha com pelo menos seis caracteres.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await requireSupabase().auth.updateUser({ password });
      if (error) throw error;
      setMessage('Senha atualizada com sucesso! Redirecionando para entrar…');
      await requireSupabase().auth.signOut();
      setTimeout(() => router.replace('/'), 1000);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a senha.'
      );
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
        <Pressable onPress={() => router.replace('/')} hitSlop={12}>
          <Text style={s.back}>‹ Voltar ao login</Text>
        </Pressable>

        <Animated.View entering={FadeInDown.duration(500)} style={s.card}>
          <View style={s.badgeWrap}>
            <Badge label="ACESSO À SUA ESTANTE" variant="violet" />
          </View>
          <Text style={s.title}>Nova senha</Text>
          <Text style={s.description}>{message}</Text>

          {ready ? (
            <>
              <Text style={s.label}>Nova senha</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                placeholder="Pelo menos seis caracteres"
                placeholderTextColor={palette.muted}
              />
              <Pressable
                style={[s.button, busy && { opacity: 0.7 }]}
                onPress={() => void save()}
                disabled={busy}
              >
                <Text style={s.buttonText}>
                  {busy ? 'Salvando nova senha…' : 'Atualizar senha  →'}
                </Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator style={{ marginTop: 24 }} color={palette.violet} />
          )}
        </Animated.View>
      </ScrollView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: palette.background },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(13, 15, 25, 0.75)',
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
  back: {
    color: '#E1D8FF',
    fontWeight: '700',
    marginBottom: 18,
    fontSize: 13,
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
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 6,
  },
  description: {
    fontSize: 13,
    color: '#C7CAD5',
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  label: {
    color: '#E4E2EE',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 14,
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
    marginTop: 20,
  },
  buttonText: {
    color: '#1E192D',
    fontWeight: '900',
    fontSize: 14,
  },
});
