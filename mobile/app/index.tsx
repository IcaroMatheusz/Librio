import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { requireSupabase } from '../src/lib/supabase';
import { AccountForm, FormField } from '../src/components/AccountForm';
import { AppSheet } from '../src/components/AppSheet';
import { LoadingIndicator } from '../src/components/Loading';
import { LibraryButton, libraryType, useLibraryTheme } from '../src/design/libraryTheme';
import { wallpapers } from '../src/config/wallpapers';
import { AuthNotice } from '../src/components/AuthNotice';
import { authFeedback, invalidEmail, validEmail, type AuthFeedback } from '../src/lib/authFeedback';

export default function SignIn() {
  const { colors } = useLibraryTheme();
  const { recover: recoverParam } = useLocalSearchParams<{ recover?: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthFeedback | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(recoverParam === '1');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState<AuthFeedback | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    try {
      const client = requireSupabase();
      client.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        if (data.session) router.replace('/library');
      });
      const { data } = client.auth.onAuthStateChange((event, next) => {
        if (event === 'PASSWORD_RECOVERY') return;
        setSession(next);
        if (next) router.replace('/library');
      });
      return () => { active = false; data.subscription.unsubscribe(); };
    } catch (caught) {
      setError(authFeedback('login', caught));
    }
  }, []));

  async function submit() {
    if (busy) return;
    if (!validEmail(email)) { setError(invalidEmail); return; }
    if (!password) {
      setError({ title: 'Informe sua senha', detail: 'Preencha a senha da sua conta para entrar.' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await requireSupabase().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;
    } catch (caught) {
      setError(authFeedback('login', caught));
    } finally {
      setBusy(false);
    }
  }

  async function recover() {
    if (recoveryBusy) return;
    if (!validEmail(recoveryEmail)) {
      setRecoveryMessage(invalidEmail);
      return;
    }
    setRecoveryBusy(true);
    setRecoveryMessage(null);
    try {
      const { error: resetError } = await requireSupabase().auth.resetPasswordForEmail(
        recoveryEmail.trim().toLowerCase(),
        { redirectTo: Linking.createURL('reset-password') }
      );
      if (resetError) throw resetError;
      setRecoveryMessage({
        tone: 'success', title: 'Confira sua caixa de entrada',
        detail: 'Se houver uma conta com esse endereço, você receberá um link. Abra o e-mail mais recente neste aparelho e verifique também a pasta de spam.',
      });
    } catch (caught) {
      setRecoveryMessage(authFeedback('recover', caught));
    } finally {
      setRecoveryBusy(false);
    }
  }

  if (session) return <View style={[s.loading, { backgroundColor: colors.background }]}><LoadingIndicator label="Carregando sua estante…" /></View>;
  return (
    <AccountForm artwork={wallpapers.login} focalPoint={0.5} title="Entrar no Librio">
      <AuthNotice feedback={error} />
      <FormField label="E-mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email}
        onChangeText={value => { setEmail(value); setError(null); }} placeholder="voce@email.com" />
      <FormField label="Senha" secureTextEntry autoComplete="password" value={password}
        onChangeText={value => { setPassword(value); setError(null); }} placeholder="Sua senha secreta" onSubmitEditing={() => void submit()} />
      <LibraryButton label={busy ? 'Entrando na conta…' : 'Entrar na minha conta'} icon="arrow-right" disabled={busy} onPress={() => void submit()} />
      <View style={s.links}>
        <LibraryButton label="Esqueci minha senha" variant="quiet" onPress={() => { setRecoveryMessage(null); setRecoveryEmail(email); setRecoveryOpen(true); }} />
        <LibraryButton label="Cadastre-se grátis" variant="quiet" onPress={() => router.push('/register')} />
      </View>
      <LibraryButton label="Ler arquivos sem conta" icon="folder-open" variant="secondary" onPress={() => router.replace({ pathname: '/library', params: { offline: '1' } })} />
      <AppSheet title="Recuperar senha" visible={recoveryOpen} onClose={() => setRecoveryOpen(false)}>
        <Text style={[libraryType.body, { color: colors.secondary }]}>Informe o e-mail da sua conta para receber um link de redefinição.</Text>
        <FormField label="E-mail de recuperação" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={recoveryEmail}
          onChangeText={value => { setRecoveryEmail(value); setRecoveryMessage(null); }} placeholder="voce@email.com" returnKeyType="send" onSubmitEditing={() => void recover()} />
        <AuthNotice feedback={recoveryMessage} />
        <LibraryButton label={recoveryBusy ? 'Enviando…' : recoveryMessage?.tone === 'success' ? 'Enviar novo link' : 'Enviar link de recuperação'} icon="mail"
          disabled={recoveryBusy} onPress={() => void recover()} />
        <LibraryButton label="Voltar para o login" variant="quiet" onPress={() => setRecoveryOpen(false)} />
      </AppSheet>
    </AccountForm>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
});
