import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, ImageBackground, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { File } from 'expo-file-system';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Action, Eyebrow, Heading, Screen, Surface, palette } from '../src/components/atoms';
import { formatBytes, getProfile, type StorageInfo } from '../src/lib/account';
import { chooseDirectory, chooseLocalFiles, getBookCoverUrl, getBooks, getBookProgress, pickAndUploadBook, readRememberedLocalFiles, rememberLocalFiles, removeBook, updateBook, updateBookCover } from '../src/lib/library';
import { requireSupabase } from '../src/lib/supabase';
import type { Book, LocalBook } from '../src/lib/types';

const art = [require('../../src/assets/mobile/bakuman.png'),require('../../src/assets/mobile/naruto.png'),require('../../src/assets/mobile/nightwing.png'),require('../../src/assets/mobile/goku.webp')];

export default function Library() {
  const [books,setBooks]=useState<Book[]>([]); const [local,setLocal]=useState<LocalBook[]>([]); const [progress,setProgress]=useState<Record<string,number>>({}); const [covers,setCovers]=useState<Record<string,string>>({});
  const [storage,setStorage]=useState<StorageInfo>({used_bytes:0,max_bytes:104857600}); const [name,setName]=useState('Sua estante'); const [avatar,setAvatar]=useState<string|null>(null);
  const [search,setSearch]=useState(''); const [busy,setBusy]=useState(false); const [refreshing,setRefreshing]=useState(false); const [tab,setTab]=useState<'cloud'|'local'>('cloud');
  const [editing,setEditing]=useState<Book|null>(null); const [title,setTitle]=useState(''); const [author,setAuthor]=useState('');
  const load = useCallback(async () => {
    try {
      const [cloud, files, account] = await Promise.all([getBooks(), readRememberedLocalFiles(), getProfile()]);
      setBooks(cloud);
      setLocal(files);
      setStorage(account.storage);
      setName(account.profile.username || 'Sua estante');
      setAvatar(account.avatarUrl);
      const [reads, coverEntries] = await Promise.all([
        Promise.all(cloud.map(async (book) => [book.id, await getBookProgress(book.id)] as const)),
        Promise.all(cloud.map(async (book) => [book.id, await getBookCoverUrl(book)] as const)),
      ]);
      setProgress(Object.fromEntries(reads));
      setCovers(Object.fromEntries(coverEntries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
    } catch (error) {
      Alert.alert('N�o foi poss�vel carregar a biblioteca', error instanceof Error ? error.message : 'Tente novamente.');
    }
  }, []);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const filtered=useMemo(()=>{const q=search.trim().toLocaleLowerCase();return books.filter(b=>!q||b.title.toLocaleLowerCase().includes(q)||b.author.toLocaleLowerCase().includes(q));},[books,search]);
  const filteredLocal=useMemo(()=>{const q=search.trim().toLocaleLowerCase();return local.filter(b=>!q||b.name.toLocaleLowerCase().includes(q));},[local,search]);
  async function perform(action:()=>Promise<unknown>){setBusy(true);try{await action();await load();}catch(e){Alert.alert('Não foi possível concluir',e instanceof Error?e.message:'Tente novamente.');}finally{setBusy(false);}}
  async function onFolder(){await perform(async()=>{const found=await chooseDirectory();await rememberLocalFiles(found);Alert.alert('Pasta analisada',`${found.length} arquivo(s) compatível(is) encontrados.`);});}
  async function signOut(){await requireSupabase().auth.signOut();router.replace('/');}
  function editBook(book:Book){setEditing(book);setTitle(book.title);setAuthor(book.author);}
  async function saveBook(){if(!editing)return;await perform(async()=>{await updateBook(editing.id,title,author);setEditing(null);});}
  const pct=storage.max_bytes?Math.min(storage.used_bytes/storage.max_bytes*100,100):0;
  return <Screen><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <View style={s.top}><View style={s.brandRow}><View style={s.brandIcon}><Text style={s.brandLetter}>L</Text></View><View><Eyebrow>SUA ESTANTE DIGITAL</Eyebrow><Text style={s.greeting}>Olá, {name.split(' ')[0]}!</Text></View></View><Pressable onPress={()=>router.push('/profile')}>{avatar?<Image source={{uri:avatar}} style={s.avatar}/>:<View style={s.avatarFallback}><Text style={s.avatarText}>{name.slice(0,1).toUpperCase()}</Text></View>}</Pressable></View>
    <Animated.View entering={FadeInDown.duration(450)}><ImageBackground source={require('../../src/assets/mobile/goku.webp')} imageStyle={s.heroImage} style={s.hero}><View style={s.heroShade}/><View style={s.heroText}><Text style={s.heroKicker}>BIBLIOTECA EM MOVIMENTO</Text><Text style={s.heroTitle}>Toda história{ '\n' }merece um lugar.</Text><Text style={s.heroSub}>Suas leituras, sempre com você.</Text></View><Text style={s.heroSymbol}>✦</Text></ImageBackground></Animated.View>
    <View style={s.statRow}><Pressable style={s.statCard} onPress={()=>setTab('cloud')}><Text style={s.statNumber}>{books.length}</Text><Text style={s.statLabel}>obras na nuvem</Text></Pressable><Pressable style={s.statCard} onPress={()=>setTab('local')}><Text style={s.statNumber}>{local.length}</Text><Text style={s.statLabel}>arquivos locais</Text></Pressable><Pressable style={[s.statCard,s.storageStat]} onPress={()=>router.push('/profile')}><Text style={s.statNumber}>{pct.toFixed(0)}%</Text><Text style={s.statLabel}>espaço usado</Text></Pressable></View>
    <Surface style={s.storage}><View style={s.storageHeader}><Text style={s.storageTitle}>Armazenamento na nuvem</Text><Text style={s.storageCount}>{formatBytes(storage.used_bytes)} / {formatBytes(storage.max_bytes)}</Text></View><View style={s.track}><View style={[s.trackFill,{width:`${pct}%`}]}/></View></Surface>
    <View style={s.quickLinks}><Pressable style={s.quick} onPress={()=>router.push('/volumes')}><Text style={s.quickIcon}>▤</Text><View><Text style={s.quickTitle}>Volumes</Text><Text style={s.quickSub}>Organize seus capítulos</Text></View><Text style={s.chevron}>›</Text></Pressable><Pressable style={s.quick} onPress={()=>router.push('/profile')}><Text style={s.quickIcon}>◉</Text><View><Text style={s.quickTitle}>Meu perfil</Text><Text style={s.quickSub}>Conta e preferências</Text></View><Text style={s.chevron}>›</Text></Pressable></View>
    <View style={s.libraryHeader}><View><Eyebrow>SEU ACERVO</Eyebrow><Heading style={s.libraryTitle}>Biblioteca</Heading></View><Pressable style={s.refresh} onPress={()=>{setRefreshing(true);void load().finally(()=>setRefreshing(false));}}><Text style={s.refreshText}>↻</Text></Pressable></View>
    <View style={s.tabs}><Pressable style={[s.tab,tab==='cloud'&&s.activeTab]} onPress={()=>setTab('cloud')}><Text style={[s.tabText,tab==='cloud'&&s.activeTabText]}>Nuvem <Text style={s.tabCount}>{books.length}</Text></Text></Pressable><Pressable style={[s.tab,tab==='local'&&s.activeTab]} onPress={()=>setTab('local')}><Text style={[s.tabText,tab==='local'&&s.activeTabText]}>Neste dispositivo <Text style={s.tabCount}>{local.length}</Text></Text></Pressable></View>
    <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder="Buscar título ou autor" placeholderTextColor="#858BA0" />
    {tab==='cloud'?<Action title={busy?'Preparando…':'＋  Enviar uma obra'} onPress={()=>void perform(pickAndUploadBook)} disabled={busy}/>:<><Action title={busy?'Analisando…':'＋  Analisar uma pasta'} onPress={()=>void onFolder()} disabled={busy}/><Action title="Escolher arquivos" quiet onPress={()=>void perform(async()=>{const files=await chooseLocalFiles();await rememberLocalFiles(files);})} disabled={busy} style={{marginTop:9}}/><Text style={s.hint}>A leitura local mantém os arquivos nos locais originais no Android. No iOS, escolha arquivos individualmente.</Text></>}
    {tab === 'cloud' ? (
      <FlatList
        scrollEnabled={false}
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={palette.violet}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          />
        }
        ListEmptyComponent={
          <Text style={s.empty}>Sua estante est� esperando pela primeira hist�ria.</Text>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index * 45, 250)).duration(350)}>
            <Pressable
              style={s.bookCard}
              onPress={() => router.push({ pathname: '/reader/[id]', params: { id: item.id } })}
            >
              <View style={s.bookCover}>
                <Image source={covers[item.id] ? { uri: covers[item.id] } : art[index % art.length]} resizeMode="cover" style={s.coverArt} />
                <View style={s.coverShade} />
                <Text style={s.coverType}>{item.file_type.toUpperCase()}</Text>
              </View>
              <View style={s.bookInfo}>
                <Text style={s.bookTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={s.bookAuthor}>{item.author || 'Autor n�o informado'}</Text>
                <Text style={s.bookMeta}>{formatBytes(item.file_size)} � Nuvem</Text>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: String(progress[item.id] ?? 0) + '%' }]} />
                </View>
                <Text style={s.progressLabel}>
                  {progress[item.id] ? String(progress[item.id]) + '% lido' : 'Ainda n�o iniciado'}
                </Text>
              </View>
              <Pressable hitSlop={12} onPress={() => editBook(item)} style={s.more}>
                <Text style={s.moreText}>���</Text>
              </Pressable>
            </Pressable>
          </Animated.View>
        )}
      />
    ) : (
      <FlatList
        scrollEnabled={false}
        data={filteredLocal}
        keyExtractor={(item) => item.uri}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>Nenhum arquivo local encontrado.</Text>}
        renderItem={({ item, index }) => (
          <Pressable
            style={s.bookCard}
            onPress={() =>
              void new File(item.uri)
                .preview({ title: item.name })
                .catch(() =>
                  Alert.alert(
                    'N�o foi poss�vel abrir',
                    'Instale um leitor compat�vel com ' + item.format.toUpperCase() + '.',
                  ),
                )
            }
          >
            <View style={s.bookCover}>
              <Image source={art[index % art.length]} resizeMode="cover" style={s.coverArt} />
              <View style={s.coverShade} />
              <Text style={s.coverType}>{item.format.toUpperCase()}</Text>
            </View>
            <View style={s.bookInfo}>
              <Text style={s.bookTitle} numberOfLines={2}>{item.name.replace(/\.[^.]+$/, '')}</Text>
              <Text style={s.bookAuthor}>Neste dispositivo</Text>
              <Text style={s.bookMeta}>{formatBytes(item.size)}</Text>
            </View>
          </Pressable>
        )}
      />
    )}
    <View style={s.bottomNote}><Text style={s.bottomNoteText}>Feito para quem sempre tem mais uma história para ler.</Text><Pressable onPress={()=>void signOut()}><Text style={s.signOut}>Sair</Text></Pressable></View>
  </ScrollView><Modal visible={!!editing} transparent animationType="fade" onRequestClose={()=>setEditing(null)}><View style={s.modalShade}><View style={s.modal}><Text style={s.modalTitle}>Editar obra</Text><Text style={s.label}>Título</Text><TextInput style={s.modalInput} value={title} onChangeText={setTitle}/><Text style={s.label}>Autor</Text><TextInput style={s.modalInput} value={author} onChangeText={setAuthor}/><Action title="Alterar capa" quiet onPress={()=>editing&&void perform(()=>updateBookCover(editing))} disabled={busy} style={{marginTop:14}}/><Action title="Salvar alterações" onPress={()=>void saveBook()} disabled={busy} style={{marginTop:15}}/><Action title="Excluir obra" quiet onPress={()=>editing&&Alert.alert('Excluir obra?',`“${editing.title}” será removida da nuvem.`,[{text:'Cancelar',style:'cancel'},{text:'Excluir',style:'destructive',onPress:()=>{const target=editing;setEditing(null);void perform(()=>removeBook(target));}}])} disabled={busy} style={{marginTop:8}}/><Pressable style={s.cancel} onPress={()=>setEditing(null)}><Text style={s.cancelText}>Cancelar</Text></Pressable></View></View></Modal></Screen>;
}
const s=StyleSheet.create({page:{paddingHorizontal:19,paddingTop:3,paddingBottom:30,gap:15},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:3},brandRow:{flexDirection:'row',alignItems:'center',gap:11},brandIcon:{width:37,height:37,borderRadius:13,backgroundColor:palette.violet,alignItems:'center',justifyContent:'center',transform:[{rotate:'-5deg'}]},brandLetter:{color:'#211A34',fontSize:22,fontWeight:'900'},greeting:{fontSize:18,color:'#fff',fontWeight:'900',marginTop:2},avatar:{width:42,height:42,borderRadius:15},avatarFallback:{width:42,height:42,borderRadius:15,backgroundColor:'#3B3550',alignItems:'center',justifyContent:'center'},avatarText:{color:palette.violetLight,fontWeight:'900',fontSize:17},hero:{height:168,borderRadius:23,overflow:'hidden',justifyContent:'center',padding:19,backgroundColor:'#27253A'},heroImage:{borderRadius:23,opacity:.74},heroShade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(19,18,33,.34)'},heroText:{zIndex:1},heroKicker:{color:'#E6DFFF',fontSize:9,fontWeight:'900',letterSpacing:1.8},heroTitle:{color:'#fff',fontSize:23,fontWeight:'900',letterSpacing:-.5,marginTop:8,lineHeight:26},heroSub:{color:'#E5E2EF',fontSize:11,marginTop:7},heroSymbol:{position:'absolute',right:20,top:18,color:'#DED1FF',fontSize:24},statRow:{flexDirection:'row',gap:8},statCard:{flex:1,backgroundColor:palette.panel,borderRadius:16,borderColor:palette.border,borderWidth:1,padding:12},storageStat:{backgroundColor:'#29253A'},statNumber:{color:'#fff',fontWeight:'900',fontSize:19},statLabel:{color:palette.muted,fontSize:9,marginTop:3},storage:{padding:14},storageHeader:{flexDirection:'row',justifyContent:'space-between',gap:8},storageTitle:{color:'#fff',fontWeight:'800',fontSize:12},storageCount:{color:palette.muted,fontSize:10},track:{height:7,borderRadius:8,backgroundColor:'#141722',overflow:'hidden',marginTop:11},trackFill:{height:7,backgroundColor:palette.violet,borderRadius:8},quickLinks:{flexDirection:'row',gap:9},quick:{flex:1,backgroundColor:'#202435',borderWidth:1,borderColor:palette.border,borderRadius:15,padding:11,flexDirection:'row',alignItems:'center',gap:9},quickIcon:{fontSize:17,color:palette.violetLight},quickTitle:{color:'#fff',fontSize:11,fontWeight:'800'},quickSub:{color:palette.muted,fontSize:9,marginTop:2},chevron:{marginLeft:'auto',color:palette.violetLight,fontSize:20},libraryHeader:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginTop:5},libraryTitle:{fontSize:24,marginTop:2},refresh:{width:36,height:36,borderRadius:13,backgroundColor:palette.panel,alignItems:'center',justifyContent:'center'},refreshText:{color:palette.violetLight,fontSize:23},tabs:{flexDirection:'row',borderBottomWidth:1,borderColor:palette.border},tab:{paddingVertical:10,paddingHorizontal:11,marginRight:8},activeTab:{borderBottomWidth:2,borderBottomColor:palette.violet},tabText:{color:palette.muted,fontWeight:'700',fontSize:12},activeTabText:{color:'#fff'},tabCount:{color:palette.violetLight,fontSize:10},search:{minHeight:45,backgroundColor:'#222638',borderColor:palette.border,borderWidth:1,borderRadius:13,paddingHorizontal:14,color:'#fff',fontSize:13},hint:{color:palette.muted,fontSize:11,lineHeight:17},list:{gap:10,paddingTop:3},empty:{color:palette.muted,textAlign:'center',paddingVertical:27,fontSize:13},bookCard:{flexDirection:'row',alignItems:'center',backgroundColor:'#222638',padding:10,borderRadius:17,borderWidth:1,borderColor:palette.border,gap:12},bookCover:{width:57,height:76,borderRadius:10,overflow:'hidden',backgroundColor:'#39334B',alignItems:'center',justifyContent:'flex-end'},coverArt:{...StyleSheet.absoluteFill,width:57,height:76,opacity:.8},coverShade:{...StyleSheet.absoluteFill,backgroundColor:'rgba(12,12,22,.25)'},coverType:{color:'#fff',fontSize:9,fontWeight:'900',letterSpacing:1,marginBottom:6,textShadowColor:'#111',textShadowRadius:4},bookInfo:{flex:1},bookTitle:{color:'#fff',fontSize:14,fontWeight:'800'},bookAuthor:{color:'#B8BDCE',fontSize:11,marginTop:4},bookMeta:{color:'#9399AB',fontSize:10,marginTop:6},progressTrack:{height:4,borderRadius:4,backgroundColor:'#141722',marginTop:8,overflow:'hidden'},progressFill:{height:4,borderRadius:4,backgroundColor:palette.violet},progressLabel:{color:'#9B9FB0',fontSize:9,marginTop:4},more:{padding:6},moreText:{color:palette.violetLight,fontSize:13},bottomNote:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:10},bottomNoteText:{color:'#858A9B',fontSize:9,flex:1},signOut:{color:'#B8A4F5',fontSize:11,fontWeight:'800',padding:6},modalShade:{flex:1,backgroundColor:'rgba(5,6,11,.72)',justifyContent:'center',padding:22},modal:{backgroundColor:'#222638',padding:22,borderRadius:22,borderWidth:1,borderColor:palette.border},modalTitle:{color:'#fff',fontSize:20,fontWeight:'900'},label:{color:'#D8DAE4',fontSize:12,fontWeight:'700',marginTop:14,marginBottom:7},modalInput:{height:48,borderRadius:12,backgroundColor:'#191D2B',color:'#fff',paddingHorizontal:12,borderColor:palette.border,borderWidth:1},cancel:{alignItems:'center',padding:13},cancelText:{color:palette.muted,fontWeight:'700'}});
