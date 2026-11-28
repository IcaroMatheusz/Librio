import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { AccountForm, FormField } from '../src/components/AccountForm';
import { LoadingIndicator } from '../src/components/Loading';
import { LibraryButton, libraryType, useLibraryTheme } from '../src/design/libraryTheme';
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
  const { colors } = useLibraryTheme();
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

  return <AccountForm artwork={wallpapers.recovery} title="Redefinir senha">
    <AuthNotice feedback={feedback} />
    {status === 'checking' && <LoadingIndicator label="Validando o link de recuperação…" />}
    {status === 'ready' && <>
      <Text style={[libraryType.body, { color: colors.secondary }]}>Escolha uma nova senha para sua conta Librio.</Text>
      <FormField label="Nova senha" value={password} secureTextEntry autoComplete="new-password"
        onChangeText={value => { setPassword(value); setFeedback(null); }} />
      <FormField label="Confirmar nova senha" value={confirmation} secureTextEntry autoComplete="new-password"
        onChangeText={value => { setConfirmation(value); setFeedback(null); }} onSubmitEditing={() => void save()} />
      <LibraryButton label={busy ? 'Salvando…' : 'Salvar nova senha'} disabled={busy} onPress={() => void save()} />
    </>}
    {status === 'invalid' && <LibraryButton label="Solicitar outro link" icon="mail" onPress={() => router.replace({ pathname: '/', params: { recover: '1' } })} />}
    <LibraryButton label="Voltar ao login" variant={status === 'done' ? 'primary' : 'quiet'} onPress={() => router.replace('/')} />
  </AccountForm>;
}
