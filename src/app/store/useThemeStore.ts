import { create } from 'zustand';
import { Appearance } from 'react-native';
import { ThemeMode, ColorPalette, lightColors, darkColors, amoledColors } from '../../theme/colors';

interface ThemeState {
  mode: ThemeMode;
  colors: ColorPalette;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const getInitialMode = (): ThemeMode => {
  const colorScheme = Appearance.getColorScheme();
  return colorScheme === 'dark' ? 'dark' : 'light';
};

const getColorsForMode = (mode: ThemeMode): ColorPalette => {
  switch (mode) {
    case 'dark':
      return darkColors;
    case 'amoled':
      return amoledColors;
    case 'light':
    default:
      return lightColors;
  }
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialMode = getInitialMode();
  return {
    mode: initialMode,
    colors: getColorsForMode(initialMode),
    setThemeMode: (mode: ThemeMode) => {
      set({ mode, colors: getColorsForMode(mode) });
    },
    toggleTheme: () => {
      const current = get().mode;
      const next: ThemeMode = current === 'light' ? 'dark' : current === 'dark' ? 'amoled' : 'light';
      set({ mode: next, colors: getColorsForMode(next) });
    },
  };
});

