export type ThemeMode = 'light' | 'dark' | 'amoled';

export interface ColorPalette {
  mode: ThemeMode;
  primary: string;
  primaryVariant: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceVariant: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  divider: string;
  error: string;
  errorBackground: string;
  success: string;
  successBackground: string;
  warning: string;
  warningBackground: string;
  info: string;
  infoBackground: string;
  overlay: string;
  ripple: string;

  // File Category Colors
  folderColor: string;
  imageColor: string;
  videoColor: string;
  audioColor: string;
  documentColor: string;
  apkColor: string;
  archiveColor: string;
  downloadColor: string;
  vaultColor: string;
}

export const lightColors: ColorPalette = {
  mode: 'light',
  primary: '#1A73E8', // Google Blue
  primaryVariant: '#1557B0',
  primaryLight: '#E8F0FE',
  secondary: '#00897B',
  accent: '#FF7043',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceVariant: '#EEF2F6',
  card: '#FFFFFF',
  cardBorder: '#E5E9F0',
  text: '#1F2937',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  border: '#E2E8F0',
  divider: '#EDF2F7',
  error: '#DC2626',
  errorBackground: '#FEE2E2',
  success: '#16A34A',
  successBackground: '#DCFCE7',
  warning: '#D97706',
  warningBackground: '#FEF3C7',
  info: '#2563EB',
  infoBackground: '#DBEAFE',
  overlay: 'rgba(0, 0, 0, 0.45)',
  ripple: 'rgba(26, 115, 232, 0.12)',

  folderColor: '#FFA000', // Solid amber folder
  imageColor: '#E91E63',
  videoColor: '#9C27B0',
  audioColor: '#00B0FF',
  documentColor: '#2196F3',
  apkColor: '#4CAF50',
  archiveColor: '#795548',
  downloadColor: '#009688',
  vaultColor: '#673AB7',
};

export const darkColors: ColorPalette = {
  mode: 'dark',
  primary: '#8AB4F8',
  primaryVariant: '#669DF6',
  primaryLight: '#1C2E4C',
  secondary: '#4DB6AC',
  accent: '#FF8A65',
  background: '#121212',
  surface: '#1E1E1E',
  surfaceVariant: '#2A2A2A',
  card: '#1E1E1E',
  cardBorder: '#333333',
  text: '#F3F4F6',
  textSecondary: '#D1D5DB',
  textMuted: '#80868B',
  border: '#333333',
  divider: '#2C2C2C',
  error: '#F87171',
  errorBackground: '#450A0A',
  success: '#4ADE80',
  successBackground: '#052E16',
  warning: '#FBBF24',
  warningBackground: '#451A03',
  info: '#60A5FA',
  infoBackground: '#172554',
  overlay: 'rgba(0, 0, 0, 0.75)',
  ripple: 'rgba(138, 180, 248, 0.16)',

  folderColor: '#FFB300',
  imageColor: '#F48FB1',
  videoColor: '#CE93D8',
  audioColor: '#81D4FA',
  documentColor: '#90CAF9',
  apkColor: '#81C784',
  archiveColor: '#BCAAA4',
  downloadColor: '#80CBC4',
  vaultColor: '#B39DDB',
};

export const amoledColors: ColorPalette = {
  ...darkColors,
  mode: 'amoled',
  background: '#000000',
  surface: '#0A0A0A',
  surfaceVariant: '#141414',
  card: '#080808',
  cardBorder: '#202020',
  border: '#222222',
  divider: '#181818',
};

