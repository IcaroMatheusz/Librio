import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useLibraryTheme } from '../design/libraryTheme';
import { AppearancePreferences } from './AppearancePreferences';
import { AppSheet, useFeedback } from './AppSheet';
import { normalizeRsvp, type RsvpSettings } from '../lib/rsvpSettings';

const preferenceKey = 'librio:page-fade';
const rsvpKey = 'librio:rsvp-settings';
const Preferences = createContext<{
  fade: boolean; enabled: boolean; setFade: (value: boolean, onStorageError?: () => void) => void; open: () => void;
  rsvp: RsvpSettings; setRsvp: (value: Partial<RsvpSettings>) => void;
}>({
  fade: false, enabled: false, setFade: () => {}, open: () => {}, rsvp: normalizeRsvp(), setRsvp: () => {},
});

export function useReaderSettings() { return useContext(Preferences); }

export function ReaderSettingsProvider({ children }: PropsWithChildren) {
  const notify = useFeedback();
  const { colors } = useLibraryTheme();
  const [writeError, setWriteError] = useState(false);
  const [open, setOpen] = useState(false);
  const [fade, setFade] = useState(false);
  const [rsvp, setRsvp] = useState(normalizeRsvp());
  const reducedMotion = useReducedMotion();
  const touched = useRef(false);
  const rsvpChanged = useRef(false);
  const rsvpWrite = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(preferenceKey).then((value) => {
      if (active && !touched.current) setFade(value === 'true');
    }).catch(() => {});
    void AsyncStorage.getItem(rsvpKey).then((value) => {
      if (active && !rsvpChanged.current && value) setRsvp(normalizeRsvp(JSON.parse(value)));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  function changeFade(value: boolean, onStorageError?: () => void) {
    touched.current = true;
    setWriteError(false);
    setFade(value);
    void AsyncStorage.setItem(preferenceKey, String(value)).catch(() => {
      if (onStorageError) onStorageError();
      else setWriteError(true);
    });
  }

  function changeRsvp(value: Partial<RsvpSettings>) {
    rsvpChanged.current = true;
    const next = normalizeRsvp(value);
    setRsvp(next);
    rsvpWrite.current = rsvpWrite.current.then(() => AsyncStorage.setItem(rsvpKey, JSON.stringify(next))).catch(() => {
      notify('Preferência não salva', 'Tente alterar a fonte ou a velocidade novamente.');
    });
  }

  return (
    <Preferences.Provider value={{ fade, enabled: fade && !reducedMotion, setFade: changeFade, open: () => { setWriteError(false); setOpen(true); }, rsvp, setRsvp: changeRsvp }}>
      {children}
      <AppSheet title="Preferências de leitura" visible={open} onClose={() => setOpen(false)}>
        <AppearancePreferences fade={fade} onFade={changeFade} />
        {writeError && <Text accessibilityLiveRegion="polite" style={{ color: colors.danger }}>Não foi possível salvar a preferência. Tente novamente.</Text>}
      </AppSheet>
    </Preferences.Provider>
  );
}
