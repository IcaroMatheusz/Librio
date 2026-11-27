import { StyleSheet, Text, View } from 'react-native';
import { palette } from './atoms';
import type { AuthFeedback } from '../lib/authFeedback';

export function AuthNotice({ feedback }: { feedback: AuthFeedback | null }) {
  if (!feedback) return null;
  return (
    <View accessibilityRole={feedback.tone ? undefined : 'alert'} accessibilityLiveRegion="polite"
      style={[s.panel, feedback.tone === 'success' ? s.success : feedback.tone === 'info' ? s.info : s.error]}>
      <Text style={s.title}>{feedback.title}</Text>
      <Text style={s.detail}>{feedback.detail}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { marginVertical: 12, gap: 4, padding: 13, borderWidth: 1, borderRadius: 12 },
  error: { backgroundColor: palette.roseGlow, borderColor: palette.rose },
  success: { backgroundColor: palette.emeraldGlow, borderColor: palette.emerald },
  info: { backgroundColor: palette.violetGlow, borderColor: palette.borderViolet },
  title: { color: palette.text, fontWeight: '800', fontSize: 15 },
  detail: { color: palette.textSecondary, fontSize: 14, lineHeight: 20 },
});
