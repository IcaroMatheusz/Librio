import { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import type { Session } from '@supabase/supabase-js';
import { requireSupabase } from '../src/lib/supabase';
import { BookIcon, palette } from '../src/components/atoms';

const wallpaper = require('../../src/assets/mobile/onepiece_wallpaper.jpg');

export default function SignIn() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false); const [recoveryEmail, setRecoveryEmail] = useState(''); const [recoveryMessage, setRecoveryMessage] = useState(''); const [recoveryBusy, setRecoveryBusy] = useState(false);
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
    if (!recoveryEmail.trim()) { setRecoveryMessage('Informe seu e-mail para receber o link de recupera\u00e7\u00e3o.'); return; }
    setRecoveryBusy(true); setRecoveryMessage('');
    try { const { error: resetError } = await requireSupabase().auth.resetPasswordForEmail(recoveryEmail.trim().toLowerCase(), { redirectTo: Linking.createURL('reset-password') }); if (resetError) throw resetError; setRecoveryMessage('Solicita\u00e7\u00e3o enviada. Se este e-mail estiver cadastrado, voc\u00ea receber\u00e1 as instru\u00e7\u00f5es para criar uma nova senha. Confira tamb\u00e9m a pasta de spam.'); }
    catch (caught) { setRecoveryMessage(caught instanceof Error ? 'N\u00e3o foi poss\u00edvel enviar: ' + caught.message : 'N\u00e3o foi poss\u00edvel enviar o e-mail. Tente novamente.'); }
    finally { setRecoveryBusy(false); }
  }
  if (session) return <View style={s.loading}><Text style={s.brand}>Librio</Text><Text style={s.sub}>Preparando sua estante…</Text></View>;
  return <ImageBackground source={wallpaper} resizeMode="cover" style={s.background}>
    <View style={s.shade} />
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInUp.duration(750)} style={s.brandBlock}><View style={s.logo}><BookIcon size={25}/></View><Text style={s.brand}>Librio<Text style={s.dot}>.</Text></Text><Text style={s.tagline}>Sua próxima aventura começa aqui.</Text></Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(650)} style={s.card}>
          <Text style={s.kicker}>SUA ESTANTE DIGITAL</Text><Text style={s.title}>Bem-vindo de volta</Text><Text style={s.caption}>Entre e continue a leitura de onde parou.</Text>
          <Text style={s.label}>E-mail</Text><TextInput autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={s.input} value={email} onChangeText={setEmail} placeholder="voce@email.com" placeholderTextColor="#777D92" />
          <Text style={s.label}>Senha</Text><TextInput secureTextEntry autoComplete="password" style={s.input} value={password} onChangeText={setPassword} placeholder="Sua senha" placeholderTextColor="#777D92" onSubmitEditing={()=>void submit()} />
          <Pressable onPress={()=>{setRecoveryMessage('');setRecoveryEmail(email);setRecoveryOpen(true);}} style={s.recover}><Text style={s.link}>Esqueci minha senha</Text></Pressable>
          <Pressable style={({pressed})=>[s.button,pressed&&s.buttonPressed,busy&&{opacity:.65}]} onPress={()=>void submit()} disabled={busy}><Text style={s.buttonText}>{busy?'Entrando…':'Entrar na minha conta'} <Text style={s.arrow}>→</Text></Text></Pressable>
          {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <View style={s.footer}><Text style={s.footerText}>Ainda não tem conta? </Text><Pressable onPress={()=>router.push('/register')}><Text style={s.linkStrong}>Cadastre-se</Text></Pressable></View>
        </Animated.View>
        <Text style={s.credit}>LIVROS · QUADRINHOS · MANGÁS</Text>
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={recoveryOpen} transparent animationType="fade" onRequestClose={()=>setRecoveryOpen(false)}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalBackdrop}><Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(130)} style={s.recoveryCard}><Text style={s.kicker}>{'RECUPERA\u00c7\u00c3O DE CONTA'}</Text><Text style={s.title}>Esqueceu sua senha?</Text><Text style={s.caption}>{'Digite seu e-mail e enviaremos um link seguro para redefinir sua senha.'}</Text><Text style={s.label}>E-mail</Text><TextInput style={s.recoveryInput} value={recoveryEmail} onChangeText={setRecoveryEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="voce@email.com" placeholderTextColor="#858BA0" returnKeyType="send" onSubmitEditing={()=>void recover()}/>{!!recoveryMessage&&<Text accessibilityRole="alert" style={s.recoveryMessage}>{recoveryMessage}</Text>}<Pressable style={[s.button,recoveryBusy&&{opacity:.65}]} onPress={()=>void recover()} disabled={recoveryBusy}><Text style={s.buttonText}>{recoveryBusy?<ActivityIndicator color="#211A34"/>: 'Enviar instru\u00e7\u00f5es'}</Text></Pressable><Pressable onPress={()=>setRecoveryOpen(false)} style={s.modalClose}><Text style={s.link}>Voltar para entrar</Text></Pressable></Animated.View></ScrollView></Modal>
  </ImageBackground>
}
const s=StyleSheet.create({flex:{flex:1},background:{flex:1,backgroundColor:palette.background},modalBackdrop:{flex:1,backgroundColor:'rgba(5,6,11,.76)',justifyContent:'center',padding:20},recoveryCard:{width:'100%',maxWidth:440,alignSelf:'center',padding:23,borderRadius:24,borderWidth:1,borderColor:'rgba(255,255,255,.17)',backgroundColor:'#222638'},recoveryMessage:{color:'#D8CCFF',fontSize:13,lineHeight:20,marginTop:12},recoveryInput:{minHeight:50,paddingHorizontal:14,borderRadius:13,borderWidth:1,borderColor:'rgba(255,255,255,.14)',backgroundColor:'#191D2B',color:'#fff',fontSize:15},modalClose:{alignItems:'center',padding:14},shade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(13,15,25,0.63)'},content:{flexGrow:1,justifyContent:'center',paddingHorizontal:22,paddingVertical:38,maxWidth:560,width:'100%',alignSelf:'center'},brandBlock:{alignItems:'center',marginBottom:25},logo:{width:50,height:50,borderRadius:17,backgroundColor:'#A78BFA',alignItems:'center',justifyContent:'center',transform:[{rotate:'-5deg'}]},logoMark:{fontSize:28,fontWeight:'900',color:'#211A34'},brand:{marginTop:9,color:'#fff',fontSize:33,fontWeight:'900',letterSpacing:-1.3},dot:{color:'#A78BFA'},tagline:{color:'#EEE9FF',fontSize:14,marginTop:2,fontWeight:'500'},card:{padding:23,borderRadius:26,borderWidth:1,borderColor:'rgba(255,255,255,.17)',backgroundColor:'rgba(25,28,43,.91)',shadowColor:'#080910',shadowOpacity:.28,shadowRadius:24,elevation:14},kicker:{color:'#C9B9FF',fontSize:10,fontWeight:'900',letterSpacing:2},title:{color:'#fff',fontSize:25,fontWeight:'900',letterSpacing:-.6,marginTop:8},caption:{color:'#B8BDCE',fontSize:13,marginTop:5,marginBottom:14},label:{color:'#E6E4EF',fontSize:12,fontWeight:'700',marginTop:12,marginBottom:7},input:{minHeight:50,paddingHorizontal:14,borderRadius:13,borderWidth:1,borderColor:'rgba(255,255,255,.12)',backgroundColor:'rgba(11,13,22,.52)',color:'#fff',fontSize:15},recover:{alignSelf:'flex-end',paddingVertical:12},link:{color:'#D2C5FF',fontSize:12,fontWeight:'700'},button:{marginTop:8,minHeight:52,backgroundColor:'#A78BFA',borderRadius:14,alignItems:'center',justifyContent:'center'},buttonPressed:{transform:[{scale:.985}],backgroundColor:'#C8B8FF'},buttonText:{fontSize:14,fontWeight:'900',color:'#211A34'},arrow:{fontSize:18},error:{marginTop:14,color:'#FFC3C3',fontSize:12,lineHeight:18},footer:{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop:19},footerText:{color:'#B8BDCE',fontSize:12},linkStrong:{color:'#E0D7FF',fontSize:12,fontWeight:'900'},credit:{textAlign:'center',color:'rgba(255,255,255,.57)',fontSize:9,fontWeight:'800',letterSpacing:2,marginTop:23},loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:palette.background},sub:{color:palette.muted,marginTop:8}});
