import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lucide } from '@react-native-vector-icons/lucide';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { dark, light, type LibraryColors } from '../config/colors';

export type LibraryPreference = 'dark' | 'light';
export type LibraryIcon = ComponentProps<typeof Lucide>['name'];

export { libraryInk, libraryGradients } from '../config/colors';

export const libraryMetrics = {
  radius: { control: 8, card: 12, sheet: 20 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  touch: 44,
  feedbackMs: 150,
} as const;

export const libraryType = StyleSheet.create({
  title: { fontSize: 29, lineHeight: 34, letterSpacing: -1.1, fontWeight: '800' },
  section: { fontSize: 21, lineHeight: 26, letterSpacing: -0.5, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
});

type ThemeContextValue = {
  mode: LibraryPreference;
  preference: LibraryPreference;
  colors: LibraryColors;
  setPreference: (value: LibraryPreference) => void;
  persistenceError: boolean;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
const appearanceKey = 'librio:library-theme';

export function LibraryThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<LibraryPreference>('dark');
  const [persistenceError, setPersistenceError] = useState(false);
  const revision = useRef(0);
  const pending = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(appearanceKey).then(saved => {
      if (active && revision.current === 0 && (saved === 'dark' || saved === 'light')) setMode(saved);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const setPreference = useCallback((value: LibraryPreference) => {
    const change = ++revision.current;
    setPersistenceError(false);
    setMode(value);
    pending.current = pending.current.then(() => AsyncStorage.setItem(appearanceKey, value)).catch(() => {
      if (revision.current === change) setPersistenceError(true);
    });
  }, []);
  const theme = useMemo(() => ({
    mode, preference: mode, colors: mode === 'dark' ? dark : light, setPreference, persistenceError,
  }), [mode, persistenceError, setPreference]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useLibraryTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('LibraryThemeProvider deve envolver a biblioteca.');
  return theme;
}

type ButtonProps = {
  label: string; icon?: LibraryIcon; onPress: () => void; disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; style?: StyleProp<ViewStyle>;
};

export function LibraryButton({ label, icon, onPress, disabled, variant = 'primary', style }: ButtonProps) {
  const { colors } = useLibraryTheme();
  const [focused, setFocused] = useState(false);
  const fills = { primary: colors.accent, secondary: colors.inset, quiet: 'transparent', danger: colors.dangerSoft };
  const ink = { primary: colors.onAccent, secondary: colors.text, quiet: colors.accent, danger: colors.danger };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled: !!disabled }}
      onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [styles.button, { backgroundColor: fills[variant] }, style,
        focused && { borderColor: ink[variant] }, pressed && styles.pressed, disabled && styles.disabled]}>
      {icon && <Lucide name={icon} size={17} color={ink[variant]} accessible={false} />}
      <Text style={[libraryType.label, styles.buttonText, { color: ink[variant] }]}>{label}</Text>
    </Pressable>
  );
}

export function LibraryIconButton({ label, icon, onPress, disabled, size = 20, style, color }: {
  label: string; icon: LibraryIcon; onPress: () => void; disabled?: boolean; size?: number; style?: StyleProp<ViewStyle>; color?: string;
}) {
  const { colors } = useLibraryTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [styles.iconButton, style, focused && { borderColor: colors.accent },
        pressed && styles.pressed, disabled && styles.disabled]}>
      <Lucide name={icon} size={size} color={color ?? colors.secondary} accessible={false} />
    </Pressable>
  );
}

export function LibraryProgress({ value, label, color, trackColor }: {
  value: number; label?: string; color?: string; trackColor?: string;
}) {
  const { colors } = useLibraryTheme();
  const percent = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label ?? 'Progresso de leitura'}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }} style={[styles.track, { backgroundColor: trackColor ?? colors.track }]}>
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color ?? colors.progress }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: libraryMetrics.touch, minWidth: libraryMetrics.touch, borderRadius: libraryMetrics.radius.control,
    borderColor: 'transparent', borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingHorizontal: 13, paddingVertical: 7, overflow: 'hidden' },
  buttonText: { flexShrink: 1, textAlign: 'center' },
  iconButton: { width: libraryMetrics.touch, height: libraryMetrics.touch, alignItems: 'center', justifyContent: 'center',
    borderRadius: libraryMetrics.radius.control, borderWidth: 1, borderColor: 'transparent', overflow: 'hidden' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  pressed: { opacity: 0.78 }, disabled: { opacity: 0.48 },
});

// Each screen creates its two immutable style sheets once, alongside its layout.
export function themedStyles<T>(build: (colors: LibraryColors) => T) {
  const sheets = { light: build(light), dark: build(dark) };
  return function useStyles() { return sheets[useLibraryTheme().mode]; };
}
