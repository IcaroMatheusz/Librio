import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import Animated, { FadeIn } from 'react-native-reanimated';
import { requireSupabase } from '../../src/lib/supabase';
import { getBookUrl, markBookOpened } from '../../src/lib/library';
import type { Book } from '../../src/lib/types';
import { Action, palette } from '../../src/components/atoms';

export default function Reader() {
  const {id}=useLocalSearchParams<{id:string}>(); const [book,setBook]=useState<Book|null>(null); const [url,setUrl]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;void(async()=>{try{const client=requireSupabase();const {data,error:bookError}=await client.from('books').select('*').eq('id',id).single();if(bookError)throw bookError;const found=data as Book;const signed=await getBookUrl(found);await markBookOpened(found.id);if(active){setBook(found);setUrl(signed);}}catch(e){if(active)setError(e instanceof Error?e.message:'Não foi possível abrir esta obra.');}})();return()=>{active=false;};},[id]);
  async function openNative(){if(!url||!book)return;setBusy(true);try{const folder=new Directory(Paths.cache,'librio-reader');if(!folder.exists)folder.create({intermediates:true});const local=await File.downloadFileAsync(url,new File(folder,`${book.id}.${book.file_type.toLowerCase()}`),{idempotent:true});await local.preview({title:book.title});}catch(e){Alert.alert('Não foi possível abrir',e instanceof Error?e.message:'Instale um leitor compatível e tente novamente.');}finally{setBusy(false);}}
  return <View style={s.screen}><View style={s.header}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Biblioteca</Text></Pressable><Text style={s.title} numberOfLines={1}>{book?.title??'Leitor'}</Text></View>
    {url&&book?.file_type.toLowerCase()==='pdf'?<WebView source={{uri:url}} style={s.web} startInLoadingState renderLoading={()=> <ActivityIndicator style={s.loader} color={palette.violet}/>}/>:error?<Text style={s.error}>{error}</Text>:<Animated.View entering={FadeIn.duration(350)} style={s.unsupported}><Text style={s.symbol}>{book?.file_type.toLowerCase()==='epub'?'Aa':'▧'}</Text><Text style={s.unsupportedTitle}>Continue sua leitura</Text><Text style={s.error}>Esta obra será aberta em um leitor compatível instalado no aparelho. Seu progresso anterior foi preservado na biblioteca.</Text><Action title={busy?'Preparando arquivo…':'Abrir em leitor compatível  →'} onPress={()=>void openNative()} disabled={busy} style={{marginTop:20}}/>{busy&&<ActivityIndicator style={{marginTop:15}} color={palette.violet}/>}</Animated.View>}
  </View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:palette.background},header:{height:58,flexDirection:'row',alignItems:'center',paddingHorizontal:16,gap:20,borderBottomColor:palette.border,borderBottomWidth:1},back:{color:palette.violetLight,fontWeight:'800'},title:{color:'#fff',fontWeight:'800',flex:1},web:{flex:1,backgroundColor:palette.background},loader:{flex:1},unsupported:{flex:1,justifyContent:'center',padding:28},symbol:{color:palette.violetLight,fontSize:35,fontWeight:'900'},unsupportedTitle:{fontSize:24,color:'#fff',fontWeight:'900',marginTop:14,marginBottom:11},error:{color:'#C1C4D1',lineHeight:22,fontSize:13}});
