import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, Text, TextInput, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { AppSheet } from './AppSheet';
import { LibraryButton, libraryType, themedStyles, useLibraryTheme } from '../design/libraryTheme';

export function PagePicker({ page, total, screen, onSelect }: {
  page: number; total: number; screen?: boolean; onSelect: (page: number) => void;
}) {
  const s = useStyles();
  const { colors } = useLibraryTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const unit = screen ? 'tela' : 'página';
  const jumpLabel = screen ? 'Ir para a tela' : 'Ir para a página';

  function select() {
    const number = Number(draft.trim());
    if (!/^\d+$/.test(draft.trim()) || number < 1 || number > total) {
      setInvalid(true);
      return;
    }
    setOpen(false);
    onSelect(number);
  }

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${jumpLabel}. Atual ${page} de ${total}`}
        accessibilityHint="Abre o seletor numérico" style={({ pressed }) => [s.trigger, pressed && s.pressed]}
        onPress={() => { setDraft(String(page)); setInvalid(false); setOpen(true); }}>
        <Lucide name="list-ordered" size={16} color={colors.accent} accessible={false} />
        <Text style={s.number}>{page} / {total}</Text>
      </Pressable>
      <AppSheet visible={open} title={jumpLabel} onClose={() => setOpen(false)} onShow={() => input.current?.focus()}>
              <Text style={[libraryType.body, { color: colors.secondary }]}>Escolha um número de 1 a {total}.</Text>
              <TextInput ref={input} accessibilityLabel={`Número da ${unit}`} selectTextOnFocus
                value={draft} onChangeText={(value) => { setDraft(value); setInvalid(false); }}
                keyboardType="number-pad" inputMode="numeric" maxLength={12} returnKeyType="go" onSubmitEditing={select}
                style={[s.input, invalid && s.invalid]} />
              {invalid && <Text accessibilityLiveRegion="polite" style={s.error}>Digite um número inteiro de 1 a {total}.</Text>}
              <LibraryButton label="Ir" onPress={select} />
      </AppSheet>
    </>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  trigger: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.inset },
  pressed: { opacity: 0.75 },
  number: { color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  input: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.controlBorder, backgroundColor: colors.inset, paddingHorizontal: 12, fontSize: 20, color: colors.text },
  invalid: { borderColor: colors.danger }, error: { color: colors.danger, fontSize: 13 },
}));
