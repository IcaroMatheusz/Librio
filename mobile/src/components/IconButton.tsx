import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import type { ComponentProps } from 'react';
import { palette } from '../config/colors';

type Props = {
  icon: ComponentProps<typeof Lucide>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: number;
};

export function IconButton({ icon, label, onPress, disabled = false, style, size = 19 }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => [s.button, style, disabled && s.disabled, pressed && s.pressed]}>
      <Lucide name={icon} size={size} color={palette.violetLight} accessible={false} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.95 }] },
});
