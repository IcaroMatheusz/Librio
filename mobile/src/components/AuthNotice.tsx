import { StyleSheet, Text, View } from 'react-native';
import { libraryType, useLibraryTheme } from '../design/libraryTheme';
import type { AuthFeedback } from '../lib/authFeedback';

export function AuthNotice({ feedback }: { feedback: AuthFeedback | null }) {
  const { colors } = useLibraryTheme();
  if (!feedback) return null;
  const accent = feedback.tone === 'success' ? colors.success : feedback.tone === 'info' ? colors.accent : colors.danger;
  return (
    <View accessibilityRole={feedback.tone ? undefined : 'alert'} accessibilityLiveRegion="polite"
      style={[s.panel, { backgroundColor: feedback.tone ? colors.surface : colors.dangerSoft, borderLeftColor: accent }]}>
      <Text style={[libraryType.label, { color: accent }]}>{feedback.title}</Text>
      <Text style={[libraryType.body, { color: colors.secondary }]}>{feedback.detail}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { gap: 4, padding: 12, borderLeftWidth: 3, borderRadius: 6 },
});
