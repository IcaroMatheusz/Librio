import { useState } from 'react';
import { router } from 'expo-router';
import { AccountForm, FormField } from '../src/components/AccountForm';
import { LibraryButton } from '../src/design/libraryTheme';
import { requireSupabase } from '../src/lib/supabase';
import { AuthNotice } from '../src/components/AuthNotice';
import { authFeedback, invalidEmail, validEmail, type AuthFeedback } from '../src/lib/authFeedback';
import { wallpapers } from '../src/config/wallpapers';

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

  return <AccountForm artwork={wallpapers.register} title="Crie sua conta">
    <AuthNotice feedback={feedback} />
    <FormField label="Nome de Usuário" value={username} autoComplete="name" autoCapitalize="words" placeholder="Digite seu nome de usuário"
      onChangeText={value => { setUsername(value); setFeedback(null); }} />
    <FormField label="E-mail" value={email} autoComplete="email" keyboardType="email-address" autoCapitalize="none" placeholder="voce@email.com"
      onChangeText={value => { setEmail(value); setFeedback(null); }} />
    <FormField label="Senha" value={password} autoComplete="new-password" secureTextEntry placeholder="Mínimo 6 caracteres"
      onChangeText={value => { setPassword(value); setFeedback(null); }} onSubmitEditing={() => void submit()} />
    <LibraryButton label={busy ? 'Criando conta…' : 'Criar minha conta'} icon="user-plus" disabled={busy} onPress={() => void submit()} />
    <LibraryButton label="Voltar ao login" variant="quiet" onPress={() => router.replace('/')} />
  </AccountForm>;
}
