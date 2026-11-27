import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, palette } from '../src/components/atoms';
import { AuthNotice } from '../src/components/AuthNotice';
import { wallpapers } from '../src/config/wallpapers';
import { authFeedback, type AuthFeedback } from '../src/lib/authFeedback';
import { requireSupabase } from '../src/lib/supabase';

const invalidLink: AuthFeedback = {
  title: 'O link de recuperação não pôde ser validado',
  detail: 'Ele pode ter expirado ou já ter sido usado. Solicite outro link e abra o e-mail mais recente neste aparelho.',
};

async function verifyLink(code?: string, tokenHash?: string, fragment?: string) {
  const { auth } = requireSupabase();
  if (code) {
    const { error } = await auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }
  if (tokenHash) {
    const { error } = await auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error) throw error;
    return;
  }
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken || params.get('type') !== 'recovery') throw new Error('Missing recovery credentials');
  const { error } = await auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw error;
}

export default function ResetPassword() {
  const { code, token_hash: tokenHash } = useLocalSearchParams<{ code?: string; token_hash?: string }>();
  const incoming = Linking.useLinkingURL();
  const fragment = code || tokenHash ? undefined : incoming?.split('#')[1];
  const verification = useRef<{ key: string; result: Promise<void> } | null>(null);
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);

  useEffect(() => {
    let active = true;
    setStatus('checking');
    setFeedback(null);

    const key = code ? `code:${code}` : tokenHash ? `token:${tokenHash}` : `fragment:${fragment ?? ''}`;
    if (verification.current?.key !== key) verification.current = { key, result: verifyLink(code, tokenHash, fragment) };
    void verification.current.result.then(() => {
      if (active) setStatus('ready');
    }).catch((error) => {
      if (!active) return;
      const mapped = authFeedback('reset', error);
      setFeedback(mapped.title === 'Não foi possível salvar a senha' ? invalidLink : mapped);
      setStatus('invalid');
    });

    return () => { active = false; };
  }, [code, fragment, tokenHash]);

  async function save() {
    if (busy || status !== 'ready') return;
    if (password.length < 6) {
      setFeedback({ title: 'A senha está curta', detail: 'Use pelo menos 6 caracteres.' });
      return;
    }
    if (password !== confirmation) {
      setFeedback({ title: 'As senhas digitadas estão diferentes', detail: 'Repita a nova senha no campo de confirmação.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const { auth } = requireSupabase();
      const { error } = await auth.updateUser({ password });
      if (error) throw error;
      setStatus('done');
      setFeedback({ tone: 'success', title: 'Senha atualizada', detail: 'Use sua nova senha da próxima vez que entrar no Librio.' });
      await auth.signOut({ scope: 'local' }).catch(() => {});
    } catch (error) {
      setFeedback(authFeedback('reset', error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ImageBackground source={wallpapers.recovery} resizeMode="cover" style={s.background}>
      <View style={s.shade} />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInDown.duration(300)} style={s.card}>
              <Text accessibilityRole="header" style={s.title}>Redefinir senha</Text>
              <AuthNotice feedback={feedback} />
              {status === 'checking' && (
                <View style={s.loading} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={palette.violet} />
                  <Text style={s.copy}>Validando o link de recuperação…</Text>
                </View>
              )}
              {status === 'ready' && (
                <>
                  <Text style={s.copy}>Escolha uma nova senha para sua conta Librio.</Text>
                  <Text style={s.label}>Nova senha</Text>
                  <TextInput accessibilityLabel="Nova senha" style={s.input} value={password} secureTextEntry autoComplete="new-password"
                    onChangeText={(value) => { setPassword(value); setFeedback(null); }} />
                  <Text style={s.label}>Confirmar nova senha</Text>
                  <TextInput accessibilityLabel="Confirmar nova senha" style={s.input} value={confirmation} secureTextEntry autoComplete="new-password"
                    onChangeText={(value) => { setConfirmation(value); setFeedback(null); }} onSubmitEditing={() => void save()} />
                  <Action style={s.action} title={busy ? 'Salvando…' : 'Salvar nova senha'} disabled={busy} onPress={() => void save()} />
                </>
              )}
              {status === 'invalid' && (
                <Action style={s.action} title="Solicitar outro link" onPress={() => router.replace({ pathname: '/', params: { recover: '1' } })} />
              )}
              <Action style={s.action} title="Voltar ao login" quiet={status !== 'done'} onPress={() => router.replace('/')} />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  background: { flex: 1, overflow: 'hidden', backgroundColor: palette.background },
  safe: { flex: 1 },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 17, 26, .67)' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22, width: '100%', maxWidth: 480, alignSelf: 'center' },
  card: { padding: 23, borderRadius: 24, borderWidth: 1, borderColor: palette.borderLight, backgroundColor: palette.panel },
  title: { color: palette.text, fontSize: 28, fontWeight: '900', marginBottom: 8 },
  copy: { color: palette.textSecondary, fontSize: 14, lineHeight: 21 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  label: { color: palette.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 5 },
  input: { backgroundColor: palette.background, color: palette.text, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: palette.border },
  action: { marginTop: 14 },
});
