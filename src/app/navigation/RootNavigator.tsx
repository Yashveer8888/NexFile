import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useThemeStore } from '../store/useThemeStore';
import { TabNavigator } from './TabNavigator';

// Stack Screens
import { SearchScreen } from '../../features/search/SearchScreen';
import { StorageAnalyzerScreen } from '../../features/storage-analyzer/StorageAnalyzerScreen';
import { PdfStudioScreen } from '../../features/pdf-studio/PdfStudioScreen';
import { DocumentConverterScreen } from '../../features/document-converter/DocumentConverterScreen';
import { ArchiveManagerScreen } from '../../features/archive/ArchiveManagerScreen';
import { PrivateVaultScreen } from '../../features/vault/PrivateVaultScreen';
import { MediaPlayerScreen } from '../../features/media-player/MediaPlayerScreen';
import { AppManagerScreen } from '../../features/app-manager/AppManagerScreen';
import { FileSharingScreen } from '../../features/file-sharing/FileSharingScreen';
import { AiAssistantScreen } from '../../features/ai-assistant/AiAssistantScreen';
import { ImagesGalleryScreen } from '../../features/images-gallery/ImagesGalleryScreen';
import { ImageViewerScreen } from '../../features/image-viewer/ImageViewerScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { colors, mode } = useThemeStore();
  const baseTheme = mode === 'light' ? DefaultTheme : DarkTheme;

  const navigationTheme = {
    ...baseTheme,
    dark: mode !== 'light',
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen name="SearchScreen" component={SearchScreen} />
        <Stack.Screen name="StorageAnalyzerScreen" component={StorageAnalyzerScreen} />
        <Stack.Screen name="PdfStudioScreen" component={PdfStudioScreen} />
        <Stack.Screen name="DocumentConverterScreen" component={DocumentConverterScreen} />
        <Stack.Screen name="ArchiveManagerScreen" component={ArchiveManagerScreen} />
        <Stack.Screen name="PrivateVaultScreen" component={PrivateVaultScreen} />
        <Stack.Screen name="MediaPlayerScreen" component={MediaPlayerScreen as any} />
        <Stack.Screen name="AppManagerScreen" component={AppManagerScreen} />
        <Stack.Screen name="FileSharingScreen" component={FileSharingScreen as any} />
        <Stack.Screen name="AiAssistantScreen" component={AiAssistantScreen} />
        <Stack.Screen name="ImagesGalleryScreen" component={ImagesGalleryScreen} />
        <Stack.Screen
          name="ImageViewerScreen"
          component={ImageViewerScreen as any}
          options={{ animation: 'fade' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
