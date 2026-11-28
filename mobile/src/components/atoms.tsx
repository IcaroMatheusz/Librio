import type { PropsWithChildren } from 'react';
import { Text, useWindowDimensions, View, type TextStyle, type ViewStyle } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LibraryButton, libraryMetrics, libraryType, useLibraryTheme } from '../design/libraryTheme';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;
  const columns = isLargeTablet ? 4 : isTablet ? 3 : width < 330 ? 1 : 2;
  const contentPadding = isTablet ? 28 : 18;
  const cardGap = isTablet ? 16 : 12;
  const maxContentWidth = isLargeTablet ? 1120 : isTablet ? 840 : 540;

  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    columns,
    contentPadding,
    cardGap,
    maxContentWidth,
  };
}

export function Screen({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors } = useLibraryTheme();
  return <SafeAreaView style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</SafeAreaView>;
}

export function BookIcon({ size = 20, color }: { size?: number; color?: string }) {
  const { colors } = useLibraryTheme();
  return <Lucide name="book-open" size={size} color={color ?? colors.accent} accessible={false} />;
}

export function Surface({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors } = useLibraryTheme();
  return <View style={[{ padding: 16, borderRadius: libraryMetrics.radius.card, backgroundColor: colors.surface }, style]}>{children}</View>;
}

export function Badge({ label }: { label: string }) {
  const { colors } = useLibraryTheme();
  return <Text style={{ color: colors.secondary, backgroundColor: colors.inset, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 3, fontSize: 10, fontWeight: '700' }}>{label}</Text>;
}

export function Action({ title, onPress, quiet, danger, disabled, style }: {
  title: string; onPress: () => void; quiet?: boolean; danger?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  return <LibraryButton label={title} onPress={onPress} disabled={disabled} style={style}
    variant={danger ? 'danger' : quiet ? 'secondary' : 'primary'} />;
}

export function Heading({ children, style }: PropsWithChildren<{ style?: TextStyle }>) {
  const { colors } = useLibraryTheme();
  return <Text accessibilityRole="header" style={[libraryType.section, { color: colors.text }, style]}>{children}</Text>;
}
