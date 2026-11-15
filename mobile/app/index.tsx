import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { requireSupabase } from '../src/lib/supabase';

export default function SignIn() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    try {
      const client = requireSupabase();
      client.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) router.replace('/library'); });
      const { data } = client.auth.onAuthStateChange((_event, next) => { setSession(next); if (next) router.replace('/library'); });
      return () => data.subscription.unsubscribe();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha na configuração.'); }
  }, []);
  async function submit() {
    setBusy(true); setError('');
    try { const { error: authError } = await requireSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password }); if (authError) throw authError; }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }
  async function recover() {
    setError('');
    try { const { error: resetError } = await requireSupabase().auth.resetPasswordForEmail(email.trim()); if (resetError) throw resetError; setError('Se o e-mail estiver cadastrado, você receberá o link de recuperação.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível enviar o e-mail.'); }
  }
  if (session) return <View style={s.center}><ActivityIndicator color="#c4b5fd" /></View>;
  return <View style={s.screen}><Text style={s.brand}>Librio</Text><Text style={s.sub}>Sua biblioteca, em qualquer lugar.</Text><Text style={s.label}>E-mail</Text><TextInput autoCapitalize="none" keyboardType="email-address" style={s.input} value={email} onChangeText={setEmail} placeholder="voce@email.com" placeholderTextColor="#8c90a3" /><Text style={s.label}>Senha</Text><TextInput secureTextEntry style={s.input} value={password} onChangeText={setPassword} placeholder="Sua senha" placeholderTextColor="#8c90a3" /><Pressable style={s.button} onPress={() => void submit()} disabled={busy}><Text style={s.buttonText}>{busy ? 'Entrando…' : 'Entrar'}</Text></Pressable><Pressable onPress={() => void recover()}><Text style={s.link}>Esqueci minha senha</Text></Pressable><Pressable onPress={() => router.push('/register')}><Text style={s.link}>Criar uma conta</Text></Pressable>{!!error && <Text style={s.error}>{error}</Text>}</View>;
}
const s = StyleSheet.create({ screen:{flex:1,justifyContent:'center',padding:28,backgroundColor:'#171a27'},center:{flex:1,alignItems:'center',justifyContent:'center'},brand:{fontSize:42,fontWeight:'800',color:'#fff'},sub:{color:'#b7bac8',marginTop:4,marginBottom:36,fontSize:16},label:{color:'#e5e7ef',fontWeight:'600',marginBottom:8,marginTop:14},input:{backgroundColor:'#242839',borderColor:'#3a4055',borderWidth:1,borderRadius:12,padding:15,color:'#fff'},button:{marginTop:24,backgroundColor:'#b8a4f5',padding:16,borderRadius:12,alignItems:'center'},buttonText:{fontWeight:'800',color:'#211b33',fontSize:16},link:{color:'#d1c4ff',textAlign:'center',padding:12,fontWeight:'600'},error:{color:'#ffc1c1',marginTop:12,lineHeight:20} });
