import { Lucide } from '@react-native-vector-icons/lucide';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { libraryMetrics, useLibraryTheme } from '../design/libraryTheme';

export function AppearancePreferences({ fade, onFade }: { fade: boolean; onFade: (value: boolean) => void }) {
  const { colors, preference, setPreference, persistenceError } = useLibraryTheme();
  const reduced = useReducedMotion();
  return (
    <>
      <View style={s.field}>
        <Text style={[s.label, { color: colors.secondary }]}>Aparência do aplicativo</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Aparência do aplicativo" style={[s.segment, { backgroundColor: colors.inset }]}>
          {(['light', 'dark'] as const).map((mode) => {
            const label = mode === 'light' ? 'Claro' : 'Escuro';
            const selected = mode === preference;
            const color = selected ? colors.accent : colors.secondary;
            return (
              <Pressable key={mode} accessibilityRole="radio" accessibilityLabel={label} aria-checked={selected} accessibilityState={{ checked: selected }}
                onPress={() => setPreference(mode)} style={({ pressed }) => [s.choice, selected && { backgroundColor: colors.accentSoft }, pressed && s.pressed]}>
                <Lucide name={mode === 'light' ? 'sun' : 'moon'} size={17} color={color} accessible={false} />
                <Text style={[s.rowLabel, s.choiceLabel, { color }]}>{label}</Text>
                {selected && <View pointerEvents="none" style={s.choiceCheck}>
                  <Lucide name="check" size={14} color={color} accessible={false} />
                </View>}
              </Pressable>
            );
          })}
        </View>
        {persistenceError && <Text accessibilityLiveRegion="polite" style={[s.detail, { color: colors.danger }]}>
          O tema foi aplicado nesta sessão. Toque novamente na sua escolha para salvar.
        </Text>}
      </View>
      <View style={[s.setting, { borderTopColor: colors.border }]}>
        <View style={s.titleBlock}>
          <Text style={[s.rowLabel, { color: colors.text }]}>Esmaecer ao carregar páginas</Text>
          <Text style={[s.detail, { color: colors.muted }]}>{reduced ? 'Reduzir movimento está ativo no aparelho.' : 'Transição suave entre páginas do leitor.'}</Text>
        </View>
        <Switch accessibilityLabel="Esmaecer ao carregar páginas" value={fade}
          onValueChange={onFade}
          trackColor={{ false: colors.controlBorder, true: colors.accent }} thumbColor={fade ? colors.onAccent : colors.secondary} />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  titleBlock: { flex: 1, gap: 3 },
  detail: { fontSize: 13, lineHeight: 19 },
  field: { gap: 7 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  segment: { flexDirection: 'row', padding: 3, gap: 3, borderRadius: libraryMetrics.radius.control },
  choice: { flex: 1, minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 21, paddingVertical: 6, gap: 6, borderRadius: libraryMetrics.radius.control },
  choiceLabel: { flexShrink: 1, textAlign: 'center', includeFontPadding: false },
  choiceCheck: { position: 'absolute', end: 5, top: 0, bottom: 0, justifyContent: 'center' },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, paddingBottom: 6 },
  rowLabel: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
