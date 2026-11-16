import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useThemeStore } from './src/app/store/useThemeStore';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { requestStoragePermissions } from './src/services/permissions/permissionsService';
import { NativeBridgeService } from './src/services/filesystem/nativeBridge';

function App(): React.JSX.Element {
  const { mode } = useThemeStore();

  useEffect(() => {
    // Request initial permissions on app launch
    requestStoragePermissions();
    // Enable full-screen immersive mode: hides top status bar & bottom navigation bar
    NativeBridgeService.setImmersiveMode(true);
  }, []);

  const barStyle = mode === 'light' ? 'dark-content' : 'light-content';

  return (
    <SafeAreaProvider>
      <StatusBar hidden={true} barStyle={barStyle} />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default App;
