import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Alert, Modal, StyleSheet, Switch, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { palette } from '../config/colors';
import { Screen } from './atoms';
import { IconButton } from './IconButton';

const preferenceKey = 'librio:page-fade';
const Preferences = createContext<{ fade: boolean; enabled: boolean; setFade: (value: boolean) => void; open: () => void }>({
  fade: false, enabled: false, setFade: () => {}, open: () => {},
});

export function useReaderSettings() { return useContext(Preferences); }

export function ReaderSettingsProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [fade, setFade] = useState(false);
  const reducedMotion = useReducedMotion();
  const touched = useRef(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(preferenceKey).then((value) => {
      if (active && !touched.current) setFade(value === 'true');
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  function changeFade(value: boolean) {
    touched.current = true;
    setFade(value);
    void AsyncStorage.setItem(preferenceKey, String(value)).catch(() =>
      Alert.alert('Preferência não salva', 'Tente novamente para lembrar essa escolha na próxima leitura.')
    );
  }

  return (
    <Preferences.Provider value={{ fade, enabled: fade && !reducedMotion, setFade: changeFade, open: () => setOpen(true) }}>
      {children}
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <Screen style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.row}>
              <Text accessibilityRole="header" style={s.heading}>Preferências de leitura</Text>
              <IconButton icon="x" label="Fechar preferências" onPress={() => setOpen(false)} />
            </View>
            <View style={s.option}>
              <View style={s.copy}>
                <Text style={s.title}>Esmaecer ao carregar páginas</Text>
                <Text style={s.body}>Aplica uma transição suave ao exibir conteúdo novo.</Text>
                {reducedMotion && <Text style={s.body}>A redução de movimento do aparelho está ativada.</Text>}
              </View>
              <Switch accessibilityLabel="Esmaecer ao carregar páginas" value={fade} onValueChange={changeFade}
                trackColor={{ false: palette.borderLight, true: palette.violetDark }} thumbColor={palette.violetLight} />
            </View>
          </View>
        </Screen>
      </Modal>
    </Preferences.Provider>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(15, 17, 26, .76)', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
  sheet: { width: '100%', maxWidth: 480, alignSelf: 'center', borderRadius: 24, borderColor: palette.borderLight, borderWidth: 1,
    padding: 19, gap: 16, backgroundColor: palette.panel },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  heading: { color: palette.text, fontSize: 21, fontWeight: '900', flex: 1 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.input, borderRadius: 14, padding: 12 },
  copy: { flex: 1, gap: 5 },
  title: { color: palette.text, fontSize: 14, fontWeight: '800' },
  body: { color: palette.muted, fontSize: 13, lineHeight: 19 },
});
