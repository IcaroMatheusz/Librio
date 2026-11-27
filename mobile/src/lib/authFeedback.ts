export type AuthFeedback = { title: string; detail: string; tone?: 'success' | 'info' };
type AuthAction = 'login' | 'register' | 'recover' | 'reset';

export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const invalidEmail: AuthFeedback = {
  title: 'Confira o e-mail',
  detail: 'Informe um endereço completo, como nome@exemplo.com.',
};

export function authFeedback(action: AuthAction, error: unknown): AuthFeedback {
  const details = error as { code?: string; status?: number; name?: string; message?: string } | null;
  const code = details?.code ?? (details?.message?.toLowerCase() === 'invalid login credentials' ? 'invalid_credentials' : undefined);
  if (code === 'invalid_credentials') return { title: 'E-mail ou senha incorretos', detail: 'Confira os dados e tente novamente. Use “Esqueci minha senha” se precisar redefinir a senha.' };
  if (code === 'email_not_confirmed') return { title: 'Confirme seu e-mail', detail: 'Abra o link de confirmação enviado no cadastro. Procure na caixa de entrada ou no spam.' };
  if (code === 'user_already_exists' || code === 'email_exists') return { title: 'Este e-mail já tem uma conta', detail: 'Entre com sua senha ou solicite um link de recuperação.' };
  if (code === 'email_address_invalid' || code === 'validation_failed') return invalidEmail;
  if (code === 'weak_password') return { title: 'Escolha uma senha mais forte', detail: 'Use pelo menos 6 caracteres e evite senhas comuns ou fáceis de adivinhar.' };
  if (code === 'same_password') return { title: 'A senha ainda é a mesma', detail: 'Escolha uma nova senha diferente da atual.' };
  if (code === 'otp_expired' || code === 'bad_code_verifier' || code === 'flow_state_expired' || code === 'flow_state_not_found') {
    return { title: 'O link de recuperação expirou ou já foi usado', detail: 'Solicite um novo link e abra o e-mail mais recente no aparelho em que iniciou a recuperação.' };
  }
  if (details?.status === 429 || code?.startsWith('over_')) return { title: 'Muitas tentativas seguidas', detail: 'Aguarde alguns minutos antes de tentar novamente.' };
  if (details?.name === 'AuthRetryableFetchError' || details?.status === 0 || details?.name === 'TypeError') {
    return { title: 'Sem conexão com o Librio', detail: 'Verifique a conexão à internet e tente novamente.' };
  }
  const titles = { login: 'Não foi possível entrar', register: 'Não foi possível criar a conta', recover: 'Não foi possível enviar o link', reset: 'Não foi possível salvar a senha' };
  return { title: titles[action], detail: 'Confira os dados informados e tente novamente.' };
}
