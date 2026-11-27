import type { PropsWithChildren } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export const palette = {
  background: '#111019',
  surface: '#1B1826',
  surfaceLight: '#2B253B',
  card: '#211D36',
  cardElevated: '#29233B',
  panel: '#211D2E',
  panelLight: '#332C45',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.15)',
  borderViolet: 'rgba(167, 139, 250, 0.28)',
  text: '#FFFFFF',
  textSecondary: '#E2E8F0',
  muted: '#B3ACBF',
  mutedDark: '#64748B',
  violet: '#BDA8FF',
  violetLight: '#DDCEFF',
  violetDark: '#7C3AED',
  violetGlow: 'rgba(167, 139, 250, 0.15)',
  amber: '#FBBF24',
  amberLight: '#FDE68A',
  amberGlow: 'rgba(251, 191, 36, 0.15)',
  emerald: '#9FE7CC',
  emeraldGlow: 'rgba(52, 211, 153, 0.15)',
  rose: '#F87171',
  roseGlow: 'rgba(248, 113, 113, 0.15)',
};

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
  return <SafeAreaView style={[styles.screen, style]}>{children}</SafeAreaView>;
}

export function BookIcon({ size = 20, color = palette.violetLight }: { size?: number; color?: string }) {
  const page = {
    flex: 1 as const,
    height: size,
    borderWidth: 1.6,
    borderColor: color,
    backgroundColor: 'rgba(255,255,255,0.025)',
  };
  return (
    <View
      accessibilityLabel="Librio"
      style={{
        width: size * 1.25,
        height: size,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={[
          page,
          {
            borderTopLeftRadius: size * 0.18,
            borderBottomLeftRadius: size * 0.18,
            borderRightWidth: 0.7,
            transform: [{ skewY: '-4deg' }],
          },
        ]}
      />
      <View
        style={[
          page,
          {
            borderTopRightRadius: size * 0.18,
            borderBottomRightRadius: size * 0.18,
            borderLeftWidth: 0.7,
            transform: [{ skewY: '4deg' }],
          },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          left: '50%',
          top: 2,
          bottom: 2,
          width: 1,
          backgroundColor: color,
          opacity: 0.75,
        }}
      />
    </View>
  );
}

export function Brand({
  compact = false,
  showBadge = false,
}: {
  compact?: boolean;
  showBadge?: boolean;
}) {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandIconWrapper}>
        <Image
          source={require('../../assets/librio-icon.png')}
          style={styles.brandIcon}
          resizeMode="cover"
        />
      </View>
      {!compact && (
        <View style={styles.brandTextGroup}>
          <Text style={styles.brandTitle}>
            Librio<Text style={styles.brandDot}>.</Text>
          </Text>
          {showBadge && (
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>APP</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export function Surface({
  children,
  style,
  glow = false,
}: PropsWithChildren<{ style?: ViewStyle | ViewStyle[]; glow?: boolean }>) {
  return (
    <Animated.View
      entering={FadeInDown.duration(360)}
      style={[styles.surface, glow && styles.surfaceGlow, style]}
    >
      {children}
    </Animated.View>
  );
}

export function Badge({
  label,
  variant = 'violet',
  icon,
}: {
  label: string;
  variant?: 'violet' | 'amber' | 'emerald' | 'rose' | 'neutral';
  icon?: string;
}) {
  const badgeStyles = {
    violet: { bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.3)', text: palette.violetLight },
    amber: { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.3)', text: palette.amberLight },
    emerald: { bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.3)', text: '#A7F3D0' },
    rose: { bg: 'rgba(248, 113, 113, 0.15)', border: 'rgba(248, 113, 113, 0.3)', text: '#FECDD3' },
    neutral: { bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.14)', text: '#E2E8F0' },
  }[variant];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: badgeStyles.bg, borderColor: badgeStyles.border },
      ]}
    >
      {icon ? <Text style={[styles.badgeIcon, { color: badgeStyles.text }]}>{icon}</Text> : null}
      <Text style={[styles.badgeText, { color: badgeStyles.text }]}>{label}</Text>
    </View>
  );
}

export function Action({
  title,
  onPress,
  quiet = false,
  outline = false,
  danger = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress: PressableProps['onPress'];
  quiet?: boolean;
  outline?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle | ViewStyle[];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        quiet && styles.actionQuiet,
        outline && styles.actionOutline,
        danger && styles.actionDanger,
        disabled && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.985 }], opacity: 0.88 },
        style,
      ]}
    >
      <View style={styles.actionInner}>
        {icon ? <Text style={styles.actionIcon}>{icon}</Text> : null}
        <Text
          style={[
            styles.actionText,
            (quiet || outline) && { color: palette.violetLight },
            danger && { color: '#FECDD3' },
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Heading({
  children,
  style,
}: PropsWithChildren<{ style?: TextStyle }>) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(167, 139, 250, 0.4)',
    overflow: 'hidden',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: {
    width: '100%',
    height: '100%',
  },
  brandTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  brandDot: {
    color: palette.violet,
  },
  brandBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  brandBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: palette.violetLight,
    letterSpacing: 0.8,
  },
  surface: {
    backgroundColor: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  surfaceGlow: {
    borderColor: palette.borderViolet,
    shadowColor: palette.violet,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeIcon: {
    fontSize: 10,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  action: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: palette.violet,
  },
  actionQuiet: {
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
  },
  actionOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.2,
    borderColor: palette.borderLight,
  },
  actionDanger: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionIcon: {
    fontSize: 13,
  },
  actionText: {
    color: '#1E192D',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  eyebrow: {
    color: palette.violetLight,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  heading: {
    color: palette.text,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
});
