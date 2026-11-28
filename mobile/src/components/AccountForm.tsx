import { useState, type PropsWithChildren } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type ImageSourcePropType, type TextInputProps } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { libraryInk, libraryType, useLibraryTheme } from '../design/libraryTheme';
import { WallpaperHero } from './WallpaperHero';
import { FormScrollView } from './FormScrollView';

export function AccountForm({ artwork, title, focalPoint = 0.5, children }: PropsWithChildren<{ artwork: ImageSourcePropType; title: string; focalPoint?: number }>) {
  const { colors } = useLibraryTheme();
  const reduced = useReducedMotion();
  return <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]}>
      <FormScrollView contentContainerStyle={s.page}>
        <WallpaperHero source={artwork} compact focalPoint={focalPoint}>
          <View accessible accessibilityLabel="Librio" style={s.brand}>
            <Lucide name="book-open" size={23} color={libraryInk.yellow} accessible={false} />
            <Text style={s.wordmark}>Librio<Text style={{ color: libraryInk.yellow }}>.</Text></Text>
          </View>
        </WallpaperHero>
        <Animated.View entering={reduced ? undefined : FadeIn.duration(150)} style={s.form}>
          <Text accessibilityRole="header" style={[libraryType.title, { color: colors.text }]}>{title}</Text>
          {children}
        </Animated.View>
      </FormScrollView>
  </SafeAreaView>;
}

export function FormField({ label, secureTextEntry, ...props }: TextInputProps & { label: string }) {
  const { colors } = useLibraryTheme();
  const [revealed, setRevealed] = useState(false);
  return <View style={s.field}>
    <Text style={[libraryType.label, { color: colors.secondary }]}>{label}</Text>
    <View>
      <TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? label} selectionColor={colors.accent}
        secureTextEntry={secureTextEntry && !revealed} placeholderTextColor={colors.muted} underlineColorAndroid="transparent"
        style={[s.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.controlBorder }, secureTextEntry && s.password, props.style]} />
      {secureTextEntry && <Pressable accessibilityRole="button"
        accessibilityLabel={`${revealed ? 'Ocultar' : 'Mostrar'} senha · ${label}`}
        onPointerDown={Platform.OS === 'web' ? event => event.preventDefault() : undefined}
        onPress={() => setRevealed(current => !current)} style={({ pressed }) => [s.eye, pressed && { opacity: 0.65 }]}>
        <Lucide name={revealed ? 'eye-off' : 'eye'} size={19} color={colors.secondary} accessible={false} />
      </Pressable>}
    </View>
  </View>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, page: { width: '100%', maxWidth: 516, alignSelf: 'center', flexGrow: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 20, gap: 22 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { color: libraryInk.white, fontSize: 31, fontWeight: '900', letterSpacing: -1.4 },
  form: { gap: 14 }, field: { gap: 5 },
  input: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },
  password: { paddingEnd: 48 },
  eye: { position: 'absolute', end: 0, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
});
