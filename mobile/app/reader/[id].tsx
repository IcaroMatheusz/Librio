import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { requireSupabase } from '../../src/lib/supabase';
import { getBookUrl } from '../../src/lib/library';
import type { Book } from '../../src/lib/types';

export default function Reader() {
  const {id}=useLocalSearchParams<{id:string}>(); const [book,setBook]=useState<Book|null>(null); const [url,setUrl]=useState(''); const [error,setError]=useState('');
  useEffect(()=>{let active=true;void(async()=>{try{const client=requireSupabase();const {data,error:bookError}=await client.from('books').select('*').eq('id',id).single();if(bookError)throw bookError;const found=data as Book;const signed=await getBookUrl(found);if(active){setBook(found);setUrl(signed);}}catch(e){if(active)setError(e instanceof Error?e.message:'Não foi possível abrir esta obra.');}})();return()=>{active=false;};},[id]);
  return <View style={s.screen}><View style={s.header}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Biblioteca</Text></Pressable><Text style={s.title} numberOfLines={1}>{book?.title??'Leitor'}</Text></View>{url&&book?.file_type.toLowerCase()==='pdf'?<WebView source={{uri:url}} style={s.web} startInLoadingState renderLoading={()=> <ActivityIndicator style={s.loader} color="#b8a4f5"/>}/>:error?<Text style={s.error}>{error}</Text>:<View style={s.unsupported}><Text style={s.unsupportedTitle}>Leitor em preparação</Text><Text style={s.error}>O aplicativo já localiza arquivos {book?.file_type.toUpperCase()??'selecionados'}. A leitura integrada de EPUB e quadrinhos requer os módulos de renderização próprios do mobile.</Text></View>}</View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#171a27'},header:{height:56,flexDirection:'row',alignItems:'center',paddingHorizontal:16,gap:20,borderBottomColor:'#30364a',borderBottomWidth:1},back:{color:'#d1c4ff',fontWeight:'700'},title:{color:'#fff',fontWeight:'700',flex:1},web:{flex:1,backgroundColor:'#171a27'},loader:{flex:1},unsupported:{flex:1,justifyContent:'center',padding:28},unsupportedTitle:{fontSize:23,color:'#fff',fontWeight:'800',marginBottom:12},error:{color:'#c1c4d1',lineHeight:22}});
