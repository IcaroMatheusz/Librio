import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type TextStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export const palette = { background: '#171A27', panel: '#222638', panelLight: '#292E42', border: 'rgba(255,255,255,0.09)', text: '#FFFFFF', muted: '#AEB2C3', violet: '#B8A4F5', violetLight: '#D8CCFF', green: '#9AE6C0', red: '#FFB9B9' };

export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>;
}

export function BookIcon({ size = 21, color = palette.violetLight }: { size?: number; color?: string }) {
  const page = { flex: 1 as const, height: size, borderWidth: 1.6, borderColor: color, backgroundColor: 'rgba(255,255,255,0.025)' };
  return <View accessibilityLabel="Librio" style={{ width: size * 1.2, height: size, flexDirection: 'row', alignItems: 'center' }}>
    <View style={[page,{borderTopLeftRadius:size*.18,borderBottomLeftRadius:size*.18,borderRightWidth:.7,transform:[{skewY:'-4deg'}]}]} />
    <View style={[page,{borderTopRightRadius:size*.18,borderBottomRightRadius:size*.18,borderLeftWidth:.7,transform:[{skewY:'4deg'}]}]} />
    <View style={{position:'absolute',left:'50%',top:2,bottom:2,width:1,backgroundColor:color,opacity:.75}} />
  </View>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
    <View style={{width:38,height:38,borderRadius:13,borderWidth:1,borderColor:'rgba(216,204,255,.55)',backgroundColor:'rgba(184,164,245,.12)',alignItems:'center',justifyContent:'center'}}><BookIcon size={19}/></View>
    {!compact&&<Text style={{color:'#fff',fontSize:19,fontWeight:'900',letterSpacing:-.5}}>Librio<Text style={{color:palette.violet}}>.</Text></Text>}
  </View>;
}

export function Surface({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <Animated.View entering={FadeInDown.duration(380)} style={[styles.surface, style]}>{children}</Animated.View>;
}

export function Action({ title, onPress, quiet = false, disabled = false, style }: { title: string; onPress: PressableProps['onPress']; quiet?: boolean; disabled?: boolean; style?: object }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.action, quiet && styles.quiet, disabled && { opacity: .5 }, pressed && { transform: [{ scale: .98 }], opacity: .88 }, style]}><Text style={[styles.actionText, quiet && { color: palette.violetLight }]}>{title}</Text></Pressable>;
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Heading({ children, style }: PropsWithChildren<{ style?: TextStyle }>) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

const styles = StyleSheet.create({ screen:{flex:1,backgroundColor:palette.background,paddingTop:56},surface:{backgroundColor:palette.panel,borderColor:palette.border,borderWidth:1,borderRadius:20,padding:18},action:{minHeight:48,paddingHorizontal:16,paddingVertical:12,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:palette.violet},quiet:{backgroundColor:'rgba(184,164,245,0.1)',borderWidth:1,borderColor:'rgba(184,164,245,0.18)'},actionText:{color:'#211A34',fontWeight:'800',fontSize:14},eyebrow:{color:palette.violetLight,fontSize:10,fontWeight:'800',letterSpacing:2},heading:{color:palette.text,fontSize:29,fontWeight:'900',letterSpacing:-.7} });
