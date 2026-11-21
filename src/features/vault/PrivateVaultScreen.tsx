import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  AppState,
  Image,
  Alert,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Lock,
  Unlock,
  ShieldCheck,
  Fingerprint,
  Plus,
  KeyRound,
  FileText,
  Image as ImageIcon,
  Video,
  Download,
  Trash2,
  X,
  Check,
  ExternalLink,
  Play,
  MoreVertical,
  Eye,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useVaultStore } from '../../app/store/useVaultStore';
import { useFileStore } from '../../app/store/useFileStore';
import { fileService } from '../../services/filesystem/fileService';
import { isImageFile, isVideoFile, isAudioFile } from '../../utils/fileTypes';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatBytes, formatDate } from '../../utils/formatters';
import { VaultItem } from '../../types/vault';
import { FileItem } from '../../types/file';

export const PrivateVaultScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    isUnlocked,
    isPinSet,
    isHydrated,
    biometricEnabled,
    items,
    activeCategory,
    setActiveCategory,
    unlockWithPin,
    unlockWithBiometric,
    lockVault,
    setPin,
    importFileToVault,
    exportFileFromVault,
    deleteVaultItem,
    deleteVaultItems,
    restoreFileFromVault,
    restoreFilesFromVault,
    changePin,
  } = useVaultStore();

  // Multi-Select states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Setup mode states (when !isPinSet)
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [createdPin, setCreatedPin] = useState('');
  const [confirmedPin, setConfirmedPin] = useState('');
  const [enableFingerprint, setEnableFingerprint] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Normal unlock states (when isPinSet)
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [changePinModalVisible, setChangePinModalVisible] = useState(false);
  const [changePinStep, setChangePinStep] = useState<'old' | 'new' | 'confirm'>('old');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [changePinError, setChangePinError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionModalItem, setActionModalItem] = useState<VaultItem | null>(null);

  // Biometric Unlock Trigger
  const handleBiometricUnlock = useCallback(async () => {
    try {
      const ok = await fileService.authenticateBiometric(
        'Private Folder',
        'Touch fingerprint sensor to unlock'
      );
      if (ok) {
        unlockWithBiometric();
        setPinError(false);
      }
    } catch {
      // Fallback to PIN entry
    }
  }, [unlockWithBiometric]);

  const handleBack = useCallback(() => {
    lockVault();
    navigation.goBack();
  }, [lockVault, navigation]);

  // Hardware Back button in Vault -> Exits selection mode first, else locks and exits
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSelectionMode) {
        setIsSelectionMode(false);
        setSelectedFileIds(new Set());
        return true;
      }
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [isSelectionMode, handleBack]);

  // Lock when PrivateVaultScreen unmounts (popped back from stack)
  useEffect(() => {
    return () => {
      lockVault();
    };
  }, [lockVault]);

  // 1. Session persistence: If already unlocked in this session, keep unlocked!
  // Only trigger unlock prompt if vault is currently locked.
  useFocusEffect(
    useCallback(() => {
      const state = useVaultStore.getState();
      if (!state.isUnlocked) {
        setEnteredPin('');
        setPinError(false);
        state.hydrate().then(() => {
          const s = useVaultStore.getState();
          if (s.isPinSet && s.biometricEnabled && !s.isUnlocked) {
            handleBiometricUnlock();
          }
        });
      }
    }, [handleBiometricUnlock])
  );

  // 2. ALWAYS lock vault whenever app goes to background / closes
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        lockVault();
        setEnteredPin('');
        setPinError(false);
      }
    });
    return () => sub.remove();
  }, [lockVault]);

  // Keypad press during setup
  const handleSetupKeyPress = (num: string) => {
    setSetupError(null);
    if (setupStep === 'create') {
      if (createdPin.length < 4) {
        const next = createdPin + num;
        setCreatedPin(next);
        if (next.length === 4) {
          setTimeout(() => {
            setSetupStep('confirm');
          }, 250);
        }
      }
    } else {
      if (confirmedPin.length < 4) {
        const next = confirmedPin + num;
        setConfirmedPin(next);
        if (next.length === 4) {
          if (next === createdPin) {
            setPin(next, enableFingerprint);
            setStatusMessage('Private Folder PIN set successfully!');
            setTimeout(() => setStatusMessage(null), 3000);
          } else {
            setSetupError('PIN does not match. Please try again.');
            setTimeout(() => {
              setConfirmedPin('');
              setCreatedPin('');
              setSetupStep('create');
              setSetupError(null);
            }, 1000);
          }
        }
      }
    }
  };

  const handleSetupDelete = () => {
    setSetupError(null);
    if (setupStep === 'create') {
      setCreatedPin((prev) => prev.slice(0, -1));
    } else {
      if (confirmedPin.length > 0) {
        setConfirmedPin((prev) => prev.slice(0, -1));
      } else {
        setSetupStep('create');
      }
    }
  };

  // Keypad press during unlock
  const handleUnlockKeyPress = (num: string) => {
    if (enteredPin.length < 4) {
      const next = enteredPin + num;
      setEnteredPin(next);
      setPinError(false);

      if (next.length === 4) {
        const success = unlockWithPin(next);
        if (!success) {
          setPinError(true);
          setTimeout(() => setEnteredPin(''), 600);
        } else {
          setEnteredPin('');
        }
      }
    }
  };

  const realAvailableFiles = useFileStore((s) => s.recentFiles).filter(
    (f) => !f.isDirectory && !f.name.startsWith('.') && !f.path.includes('/.vault')
  ).slice(0, 15);

  const getItemFilePath = (item: VaultItem) => {
    return (
      item.vaultFilePath ||
      item.encryptedPath.replace('/.vault/', '/.vault/files/').replace(/\.nvlt$/, '')
    );
  };

  const handleOpenItem = async (item: VaultItem) => {
    const filePath = getItemFilePath(item);
    const fileItem: FileItem = {
      id: item.id,
      name: item.name,
      path: filePath,
      size: item.size,
      lastModified: item.encryptedAt,
      mimeType: item.mimeType,
      extension: item.name.split('.').pop()?.toLowerCase() || '',
      isDirectory: false,
      thumbnailUri: `file://${filePath}`,
    };

    if (item.category === 'images' || isImageFile(fileItem)) {
      const allVaultImages: FileItem[] = items
        .filter((i) => {
          const p = getItemFilePath(i);
          const ext = i.name.split('.').pop()?.toLowerCase() || '';
          return i.category === 'images' || isImageFile({ name: i.name, path: p, extension: ext, isDirectory: false } as any);
        })
        .map((i) => {
          const p = getItemFilePath(i);
          return {
            id: i.id,
            name: i.name,
            path: p,
            size: i.size,
            lastModified: i.encryptedAt,
            mimeType: i.mimeType,
            extension: i.name.split('.').pop()?.toLowerCase() || '',
            isDirectory: false,
            thumbnailUri: `file://${p}`,
          };
        });

      const idx = allVaultImages.findIndex((img) => img.id === item.id);
      navigation.navigate('ImageViewerScreen', {
        images: allVaultImages.length > 0 ? allVaultImages : [fileItem],
        initialIndex: Math.max(0, idx),
      });
    } else if (item.category === 'videos' || isVideoFile(fileItem)) {
      const allVaultVideos: FileItem[] = items
        .filter((i) => {
          const p = getItemFilePath(i);
          const ext = i.name.split('.').pop()?.toLowerCase() || '';
          return i.category === 'videos' || isVideoFile({ name: i.name, path: p, extension: ext, isDirectory: false } as any);
        })
        .map((i) => {
          const p = getItemFilePath(i);
          return {
            id: i.id,
            name: i.name,
            path: p,
            size: i.size,
            lastModified: i.encryptedAt,
            mimeType: i.mimeType,
            extension: i.name.split('.').pop()?.toLowerCase() || '',
            isDirectory: false,
            thumbnailUri: `file://${p}`,
          };
        });

      navigation.navigate('MediaPlayerScreen', {
        file: fileItem,
        playlist: allVaultVideos.length > 0 ? allVaultVideos : [fileItem],
      });
    } else if (item.category === 'audio' || isAudioFile(fileItem)) {
      const allVaultAudios: FileItem[] = items
        .filter((i) => {
          const p = getItemFilePath(i);
          const ext = i.name.split('.').pop()?.toLowerCase() || '';
          return (
            i.category === 'audio' ||
            isAudioFile({ name: i.name, path: p, extension: ext, isDirectory: false } as any)
          );
        })
        .map((i) => {
          const p = getItemFilePath(i);
          return {
            id: i.id,
            name: i.name,
            path: p,
            size: i.size,
            lastModified: i.encryptedAt,
            mimeType: i.mimeType,
            extension: i.name.split('.').pop()?.toLowerCase() || '',
            isDirectory: false,
            category: 'audio' as const,
          };
        });

      navigation.navigate('AudioPlayerScreen', {
        file: fileItem,
        playlist: allVaultAudios.length > 0 ? allVaultAudios : [fileItem],
      });
    } else {
      try {
        await fileService.openFile(filePath, item.mimeType);
      } catch (err: any) {
        Alert.alert('Cannot Open File', err?.message || 'No app available to open this file.');
      }
    }
  };

  const handleDeleteItem = (item: VaultItem) => {
    Alert.alert(
      'Delete Permanently',
      `Are you sure you want to permanently delete "${item.name}" from your Private Folder? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVaultItem(item.id);
              setStatusMessage(`Deleted permanently: ${item.name}`);
              setTimeout(() => setStatusMessage(null), 3000);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete file.');
            }
          },
        },
      ]
    );
  };

  const handleImportFile = async (filePath: string, fileName: string) => {
    try {
      await importFileToVault(filePath, '0000');
      setImportModalVisible(false);
      setStatusMessage(`Encrypted & Moved to Private Folder: ${fileName}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e: any) {
      console.warn('Import error:', e);
    }
  };

  const handleExport = async (item: VaultItem) => {
    try {
      const exportedPath = await exportFileFromVault(item.id, '/storage/emulated/0/Download', '0000');
      setStatusMessage(`Decrypted & Exported to Downloads: ${item.name}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.warn('Export error:', e);
    }
  };

  const filteredItems = activeCategory === 'all'
    ? items
    : items.filter((i) => i.category === activeCategory);

  const toggleSelect = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setIsSelectionMode(false);
      }
      return next;
    });
  };

  const handleStartSelection = (initialId?: string) => {
    setIsSelectionMode(true);
    if (initialId) {
      setSelectedFileIds(new Set([initialId]));
    }
  };

  const handleSelectAll = () => {
    if (selectedFileIds.size === filteredItems.length) {
      setSelectedFileIds(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedFileIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const handleInvertSelection = () => {
    const next = new Set<string>();
    filteredItems.forEach((i) => {
      if (!selectedFileIds.has(i.id)) {
        next.add(i.id);
      }
    });
    if (next.size === 0) {
      setIsSelectionMode(false);
    }
    setSelectedFileIds(next);
  };

  const handleClearSelection = () => {
    setIsSelectionMode(false);
    setSelectedFileIds(new Set());
  };

  // Batch Restore to Original Location ("file vhi jaye jha se private ki thi")
  const handleBatchRestore = async () => {
    if (selectedFileIds.size === 0) return;
    const count = selectedFileIds.size;
    try {
      const res = await restoreFilesFromVault(Array.from(selectedFileIds));
      handleClearSelection();
      setStatusMessage(
        res.restoredCount > 0
          ? `Restored ${res.restoredCount} file${res.restoredCount > 1 ? 's' : ''} to original location!`
          : 'Failed to restore files'
      );
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e: any) {
      Alert.alert('Restore Error', e?.message || 'Could not restore files.');
    }
  };

  // Single Item Restore to Original Location
  const handleSingleRestore = async (item: VaultItem) => {
    try {
      const restoredPath = await restoreFileFromVault(item.id);
      setStatusMessage(`Restored to: ${item.originalPath || restoredPath}`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e: any) {
      Alert.alert('Restore Error', e?.message || 'Could not restore file.');
    }
  };

  // Batch Delete Permanently
  const handleBatchDelete = () => {
    if (selectedFileIds.size === 0) return;
    const count = selectedFileIds.size;
    Alert.alert(
      'Delete Permanently',
      `Are you sure you want to permanently delete ${count} file${count > 1 ? 's' : ''} from Private Folder? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVaultItems(Array.from(selectedFileIds));
              handleClearSelection();
              setStatusMessage(`Deleted permanently: ${count} file${count > 1 ? 's' : ''}`);
              setTimeout(() => setStatusMessage(null), 3000);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete files.');
            }
          },
        },
      ]
    );
  };

  // Handle keypad press during PIN change
  const handleChangePinKeyPress = (num: string) => {
    setChangePinError(null);
    if (changePinStep === 'old') {
      if (oldPin.length < 4) {
        const next = oldPin + num;
        setOldPin(next);
        if (next.length === 4) {
          // Verify old PIN
          const ok = unlockWithPin(next);
          if (ok) {
            setTimeout(() => setChangePinStep('new'), 250);
          } else {
            setChangePinError('Current PIN is incorrect');
            setTimeout(() => setOldPin(''), 600);
          }
        }
      }
    } else if (changePinStep === 'new') {
      if (newPin.length < 4) {
        const next = newPin + num;
        setNewPin(next);
        if (next.length === 4) {
          setTimeout(() => setChangePinStep('confirm'), 250);
        }
      }
    } else {
      if (confirmNewPin.length < 4) {
        const next = confirmNewPin + num;
        setConfirmNewPin(next);
        if (next.length === 4) {
          if (next === newPin) {
            const success = changePin(oldPin, next);
            if (success) {
              setChangePinModalVisible(false);
              setOldPin('');
              setNewPin('');
              setConfirmNewPin('');
              setChangePinStep('old');
              setChangePinError(null);
              setStatusMessage('Private Folder PIN changed successfully!');
              setTimeout(() => setStatusMessage(null), 3000);
            } else {
              setChangePinError('Failed to change PIN. Please try again.');
            }
          } else {
            setChangePinError('PIN does not match. Please try again.');
            setTimeout(() => {
              setConfirmNewPin('');
              setNewPin('');
              setChangePinStep('new');
              setChangePinError(null);
            }, 1000);
          }
        }
      }
    }
  };

  const handleChangePinDelete = () => {
    setChangePinError(null);
    if (changePinStep === 'old') {
      setOldPin((prev) => prev.slice(0, -1));
    } else if (changePinStep === 'new') {
      setNewPin((prev) => prev.slice(0, -1));
    } else {
      if (confirmNewPin.length > 0) {
        setConfirmNewPin((prev) => prev.slice(0, -1));
      } else {
        setChangePinStep('new');
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {isSelectionMode ? (
        <View style={[styles.selectionHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClearSelection} style={styles.headerBtn}>
            <X size={22} color={colors.text} />
          </TouchableOpacity>

          <Text style={[typography.h3, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>
            {selectedFileIds.size} Selected
          </Text>

          <TouchableOpacity onPress={handleInvertSelection} style={styles.selectionTopActionBtn}>
            <Text style={[typography.labelMedium, { color: colors.primary, fontWeight: '700' }]}>
              Invert
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSelectAll} style={styles.selectionTopActionBtn}>
            <Text style={[typography.labelMedium, { color: colors.primary, fontWeight: '700' }]}>
              {selectedFileIds.size === filteredItems.length ? 'Clear' : 'All'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Header
          title="Private Folder"
          subtitle={isUnlocked ? 'AES-256 Encrypted • Unlocked' : !isPinSet ? 'Setup Password' : 'Locked Storage'}
          showBack
          onBack={handleBack}
          showThemeToggle
          rightActions={
            isUnlocked ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {filteredItems.length > 0 && (
                  <TouchableOpacity
                    onPress={() => handleStartSelection()}
                    style={styles.headerBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[typography.labelMedium, { color: colors.primary, fontWeight: '700' }]}>
                      Select
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setChangePinStep('old');
                    setOldPin('');
                    setNewPin('');
                    setConfirmNewPin('');
                    setChangePinError(null);
                    setChangePinModalVisible(true);
                  }}
                  style={styles.headerBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <KeyRound size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : undefined
          }
        />
      )}

      {!isUnlocked ? (
        !isHydrated ? (
          <View style={[styles.lockScreen, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 16 }]}>
              Securing Private Folder...
            </Text>
          </View>
        ) : !isPinSet ? (
          /* =========================================================================
             1. SETUP PIN & FINGERPRINT SCREEN (Shown when password is not set yet)
             ========================================================================= */
          <View style={styles.lockScreen}>
            <View style={[styles.lockIconCircle, { backgroundColor: 'rgba(105, 240, 174, 0.16)' }]}>
              <ShieldCheck size={38} color="#69F0AE" />
            </View>
            <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md, textAlign: 'center' }]}>
              {setupStep === 'create' ? 'Set Private Folder PIN' : 'Confirm Your PIN'}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}>
              {setupStep === 'create'
                ? 'Create a 4-digit PIN to secure your private files'
                : 'Enter the same 4-digit PIN again to confirm'}
            </Text>

            {/* PIN Indicators */}
            <View style={styles.pinIndicatorRow}>
              {[0, 1, 2, 3].map((idx) => {
                const currentPin = setupStep === 'create' ? createdPin : confirmedPin;
                const isFilled = currentPin.length > idx;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.pinDot,
                      {
                        backgroundColor: isFilled
                          ? setupError
                            ? colors.error
                            : '#69F0AE'
                          : colors.surfaceVariant,
                        borderColor: setupError ? colors.error : colors.border,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {setupError && (
              <Text style={[typography.labelSmall, { color: colors.error, marginTop: spacing.sm }]}>
                {setupError}
              </Text>
            )}

            {/* Fingerprint Option Toggle */}
            <TouchableOpacity
              style={[
                styles.fingerprintOptionBox,
                {
                  backgroundColor: enableFingerprint ? 'rgba(105, 240, 174, 0.12)' : colors.surfaceVariant,
                  borderColor: enableFingerprint ? '#69F0AE' : colors.border,
                },
              ]}
              onPress={() => setEnableFingerprint((prev) => !prev)}
              activeOpacity={0.75}
            >
              <View style={styles.fingerprintOptionLeft}>
                <Fingerprint size={24} color={enableFingerprint ? '#69F0AE' : colors.textMuted} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[typography.labelMedium, { color: colors.text, fontWeight: '700' }]}>
                    Fingerprint Unlock
                  </Text>
                  <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: 2 }]}>
                    Unlock quickly with your fingerprint
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.checkCircle,
                  {
                    backgroundColor: enableFingerprint ? '#69F0AE' : 'transparent',
                    borderColor: enableFingerprint ? '#69F0AE' : colors.border,
                  },
                ]}
              >
                {enableFingerprint && <Check size={14} color="#000000" />}
              </View>
            </TouchableOpacity>

            {/* Numeric Keypad for Setup */}
            <View style={styles.keypad}>
              {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
                <View key={rIdx} style={styles.keypadRow}>
                  {row.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[styles.keypadButton, { backgroundColor: colors.surface }]}
                      onPress={() => handleSetupKeyPress(num)}
                      activeOpacity={0.7}
                    >
                      <Text style={[typography.h2, { color: colors.text }]}>{num}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              <View style={styles.keypadRow}>
                <View style={[styles.keypadButton, { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 }]} />

                <TouchableOpacity
                  style={[styles.keypadButton, { backgroundColor: colors.surface }]}
                  onPress={() => handleSetupKeyPress('0')}
                >
                  <Text style={[typography.h2, { color: colors.text }]}>0</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.keypadButton, { backgroundColor: colors.surfaceVariant }]}
                  onPress={handleSetupDelete}
                >
                  <Text style={[typography.labelMedium, { color: colors.text }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* =========================================================================
             2. UNLOCK SCREEN WITH PIN & FINGERPRINT
             ========================================================================= */
          <View style={styles.lockScreen}>
            <View style={[styles.lockIconCircle, { backgroundColor: `${colors.vaultColor}20` }]}>
              <Lock size={36} color={colors.vaultColor} />
            </View>
            <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md }]}>
              Private Folder Locked
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}>
              Enter your 4-digit PIN or use fingerprint to unlock
            </Text>

            {/* PIN Indicators */}
            <View style={styles.pinIndicatorRow}>
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = enteredPin.length > idx;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.pinDot,
                      {
                        backgroundColor: isFilled
                          ? pinError
                            ? colors.error
                            : colors.primary
                          : colors.surfaceVariant,
                        borderColor: pinError ? colors.error : colors.border,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {pinError && (
              <Text style={[typography.labelSmall, { color: colors.error, marginTop: spacing.sm }]}>
                Incorrect PIN. Please try again.
              </Text>
            )}

            {/* Numeric Keypad with Fingerprint Option */}
            <View style={styles.keypad}>
              {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
                <View key={rIdx} style={styles.keypadRow}>
                  {row.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[styles.keypadButton, { backgroundColor: colors.surface }]}
                      onPress={() => handleUnlockKeyPress(num)}
                      activeOpacity={0.7}
                    >
                      <Text style={[typography.h2, { color: colors.text }]}>{num}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              <View style={styles.keypadRow}>
                {/* Fingerprint Button */}
                <TouchableOpacity
                  style={[
                    styles.keypadButton,
                    {
                      backgroundColor: 'rgba(105, 240, 174, 0.18)',
                      borderWidth: 1.5,
                      borderColor: '#69F0AE',
                    },
                  ]}
                  onPress={handleBiometricUnlock}
                  activeOpacity={0.7}
                >
                  <Fingerprint size={32} color="#69F0AE" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.keypadButton, { backgroundColor: colors.surface }]}
                  onPress={() => handleUnlockKeyPress('0')}
                >
                  <Text style={[typography.h2, { color: colors.text }]}>0</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.keypadButton, { backgroundColor: colors.surfaceVariant }]}
                  onPress={() => setEnteredPin(enteredPin.slice(0, -1))}
                >
                  <Text style={[typography.labelMedium, { color: colors.text }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )
      ) : (
        /* Vault Dashboard */
        <ScrollView contentContainerStyle={styles.vaultScroll} showsVerticalScrollIndicator={false}>
          {statusMessage && (
            <View style={[styles.statusToast, { backgroundColor: colors.successBackground }]}>
              <Text style={[typography.labelMedium, { color: colors.success }]}>{statusMessage}</Text>
            </View>
          )}

          {/* Category Filter Pills */}
          <View style={styles.categoryPills}>
            {(['all', 'images', 'videos', 'documents', 'other'] as const).map((cat) => {
              const isSelected = activeCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catPill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: isSelected ? '#FFFFFF' : colors.text, textTransform: 'capitalize' },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Vault Items List */}
          <View style={styles.itemsHeader}>
            <Text style={[typography.h3, { color: colors.text }]}>
              Private Files ({filteredItems.length})
            </Text>
            
          </View>

          {filteredItems.length === 0 ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 }}>
              <ShieldCheck size={54} color={colors.textMuted} />
              <Text style={[typography.h3, { color: colors.text, marginTop: spacing.md, textAlign: 'center' }]}>
                Private Folder is Empty
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
                Only files you choose to lock will appear here. No demo files. Lock any sensitive image, video, audio or document from Recent, Folders, or Categories.
              </Text>
              {realAvailableFiles.length > 0 && (
                <Button
                  title="Import from Device"
                  variant="primary"
                  size="md"
                  icon={<Plus size={16} color="#FFFFFF" />}
                  style={{ marginTop: spacing.lg }}
                  onPress={() => setImportModalVisible(true)}
                />
              )}
            </View>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedFileIds.has(item.id);
              const filePath = getItemFilePath(item);
              const ext = item.name.split('.').pop()?.toLowerCase() || '';
              const isImg = item.category === 'images' || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
              const isVid = item.category === 'videos' || ['mp4', 'mkv', 'webm', '3gp', 'avi', 'mov'].includes(ext);

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (isSelectionMode) {
                      toggleSelect(item.id);
                    } else {
                      handleOpenItem(item);
                    }
                  }}
                  onLongPress={() => {
                    if (!isSelectionMode) {
                      handleStartSelection(item.id);
                    } else {
                      toggleSelect(item.id);
                    }
                  }}
                >
                  <Card
                    style={[
                      styles.vaultItemCard,
                      isSelected && {
                        borderColor: colors.primary,
                        backgroundColor: `${colors.primary}0D`,
                        borderWidth: 1.5,
                      },
                    ]}
                  >
                    <View style={styles.vaultItemRow}>
                      {isSelectionMode && (
                        <View
                          style={[
                            styles.selectionCheckCircle,
                            {
                              backgroundColor: isSelected ? colors.primary : 'transparent',
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          {isSelected && <Check size={14} color="#FFFFFF" />}
                        </View>
                      )}

                      <View style={styles.vaultThumbWrapper}>
                        {isImg ? (
                          <Image
                            source={{ uri: `file://${filePath}` }}
                            style={styles.vaultMediaThumb}
                            resizeMode="cover"
                          />
                        ) : isVid ? (
                          <View style={styles.vaultVidWrapper}>
                            <Image
                              source={{ uri: `file://${filePath}` }}
                              style={styles.vaultMediaThumb}
                              resizeMode="cover"
                            />
                            <View style={styles.vaultPlayOverlayBadge}>
                              <Play size={14} color="#FFFFFF" fill="#FFFFFF" />
                            </View>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.vaultDocThumb,
                              { backgroundColor: `${colors.vaultColor}18` },
                            ]}
                          >
                            <FileText size={22} color={colors.vaultColor} />
                            <Text
                              style={[styles.vaultDocTag, { color: colors.vaultColor }]}
                              numberOfLines={1}
                            >
                              {ext.toUpperCase() || 'FILE'}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.itemInfo}>
                        <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
                          {formatBytes(item.size)} • {item.originalPath ? item.originalPath.split('/').slice(-3, -1).join('/') : formatDate(item.encryptedAt)}
                        </Text>
                      </View>

                      {!isSelectionMode && (
                        <TouchableOpacity
                          style={styles.actionIconBtn}
                          onPress={() => setActionModalItem(item)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                          <MoreVertical size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Bottom Sticky Action Bar in Multi-Select Mode */}
      {isSelectionMode && selectedFileIds.size > 0 && (
        <View
          style={[
            styles.selectionBottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          {/* Restore / Non-Private Button */}
          <TouchableOpacity
            style={[styles.bottomActionBtn, { backgroundColor: `${colors.primary}15` }]}
            onPress={handleBatchRestore}
            activeOpacity={0.7}
          >
            <Unlock size={22} color={colors.primary} />
            <Text style={[typography.labelMedium, { color: colors.primary, marginTop: 4, fontWeight: '700' }]}>
              Restore ({selectedFileIds.size})
            </Text>
            <Text style={[typography.labelSmall, { color: colors.textMuted, fontSize: 10 }]}>
              To Original Folder
            </Text>
          </TouchableOpacity>

          {/* Delete Permanently Button */}
          <TouchableOpacity
            style={[styles.bottomActionBtn, { backgroundColor: `${colors.error}15` }]}
            onPress={handleBatchDelete}
            activeOpacity={0.7}
          >
            <Trash2 size={22} color={colors.error} />
            <Text style={[typography.labelMedium, { color: colors.error, marginTop: 4, fontWeight: '700' }]}>
              Delete Permanently
            </Text>
            <Text style={[typography.labelSmall, { color: colors.error, fontSize: 10, opacity: 0.8 }]}>
              Erase {selectedFileIds.size} file{selectedFileIds.size > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Sheet Modal for Selected Vault Item */}
      <Modal visible={!!actionModalItem} transparent animationType="fade">
        <TouchableOpacity
          style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setActionModalItem(null)}
        >
          <View
            style={[
              styles.actionSheetBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.actionSheetHeader}>
              <Text
                style={[typography.h3, { color: colors.text, flex: 1 }]}
                numberOfLines={1}
              >
                {actionModalItem?.name}
              </Text>
              <TouchableOpacity onPress={() => setActionModalItem(null)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text
              style={[
                typography.bodySmall,
                { color: colors.textMuted, marginBottom: spacing.md },
              ]}
            >
              {actionModalItem ? formatBytes(actionModalItem.size) : ''} • Private Storage
            </Text>

            {/* Option 1: Open */}
            <TouchableOpacity
              style={[styles.actionOptionRow, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => {
                if (actionModalItem) {
                  const target = actionModalItem;
                  setActionModalItem(null);
                  handleOpenItem(target);
                }
              }}
            >
              <View style={[styles.actionOptionIcon, { backgroundColor: `${colors.primary}20` }]}>
                {actionModalItem?.category === 'videos' ? (
                  <Play size={18} color={colors.primary} fill={colors.primary} />
                ) : (
                  <Eye size={18} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[typography.labelMedium, { color: colors.text }]}>
                  {actionModalItem?.category === 'videos' ? 'Play Video' : 'Open in Private Folder'}
                </Text>
                <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
                  View or play without exporting
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Restore to Original Location (Non-Private) */}
            <TouchableOpacity
              style={[styles.actionOptionRow, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => {
                if (actionModalItem) {
                  const target = actionModalItem;
                  setActionModalItem(null);
                  handleSingleRestore(target);
                }
              }}
            >
              <View style={[styles.actionOptionIcon, { backgroundColor: `${colors.primary}20` }]}>
                <Unlock size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[typography.labelMedium, { color: colors.text, fontWeight: '700' }]}>
                  Make Non-Private (Restore)
                </Text>
                <Text style={[typography.labelSmall, { color: colors.textMuted }]} numberOfLines={1}>
                  Restore back to: {actionModalItem?.originalPath || 'Original Location'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 3: Delete Permanently */}
            <TouchableOpacity
              style={[styles.actionOptionRow, { backgroundColor: `${colors.error}10` }]}
              onPress={() => {
                if (actionModalItem) {
                  const target = actionModalItem;
                  setActionModalItem(null);
                  handleDeleteItem(target);
                }
              }}
            >
              <View style={[styles.actionOptionIcon, { backgroundColor: `${colors.error}20` }]}>
                <Trash2 size={18} color={colors.error} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[typography.labelMedium, { color: colors.error }]}>
                  Delete Permanently
                </Text>
                <Text style={[typography.labelSmall, { color: colors.error, opacity: 0.8 }]}>
                  Remove from vault and erase permanently
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Change Passcode Modal */}
      <Modal visible={changePinModalVisible} transparent animationType="fade">
        <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <KeyRound size={22} color={colors.primary} />
                <Text style={[typography.h3, { color: colors.text }]}>Change Passcode</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setChangePinModalVisible(false);
                  setOldPin('');
                  setNewPin('');
                  setConfirmNewPin('');
                  setChangePinStep('old');
                  setChangePinError(null);
                }}
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}>
              {changePinStep === 'old'
                ? 'Enter your current 4-digit PIN'
                : changePinStep === 'new'
                ? 'Enter your new 4-digit PIN'
                : 'Confirm your new 4-digit PIN'}
            </Text>

            {/* PIN Dots */}
            <View style={styles.pinIndicatorRow}>
              {[0, 1, 2, 3].map((idx) => {
                const currentVal =
                  changePinStep === 'old'
                    ? oldPin
                    : changePinStep === 'new'
                    ? newPin
                    : confirmNewPin;
                const isFilled = currentVal.length > idx;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.pinDot,
                      {
                        backgroundColor: isFilled
                          ? changePinError
                            ? colors.error
                            : colors.primary
                          : colors.surfaceVariant,
                        borderColor: changePinError ? colors.error : colors.border,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {changePinError && (
              <Text style={[typography.labelSmall, { color: colors.error, marginTop: spacing.sm, textAlign: 'center' }]}>
                {changePinError}
              </Text>
            )}

            {/* Keypad */}
            <View style={[styles.keypad, { width: '100%', marginTop: spacing.lg }]}>
              {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
                <View key={rIdx} style={styles.keypadRow}>
                  {row.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[styles.keypadButton, { backgroundColor: colors.surfaceVariant, width: 62, height: 62, borderRadius: 31 }]}
                      onPress={() => handleChangePinKeyPress(num)}
                      activeOpacity={0.7}
                    >
                      <Text style={[typography.h3, { color: colors.text }]}>{num}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              <View style={styles.keypadRow}>
                <View style={[styles.keypadButton, { backgroundColor: 'transparent', elevation: 0, width: 62, height: 62 }]} />
                <TouchableOpacity
                  style={[styles.keypadButton, { backgroundColor: colors.surfaceVariant, width: 62, height: 62, borderRadius: 31 }]}
                  onPress={() => handleChangePinKeyPress('0')}
                  activeOpacity={0.7}
                >
                  <Text style={[typography.h3, { color: colors.text }]}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.keypadButton, { backgroundColor: colors.surfaceVariant, width: 62, height: 62, borderRadius: 31 }]}
                  onPress={handleChangePinDelete}
                  activeOpacity={0.7}
                >
                  <Text style={[typography.labelMedium, { color: colors.text }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Import Real Files Modal */}
      <Modal visible={importModalVisible} transparent animationType="fade">
        <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogBox, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: '80%' }]}>
            <View style={styles.dialogHeader}>
              <Text style={[typography.h3, { color: colors.text }]}>Import Real File to Vault</Text>
              <TouchableOpacity onPress={() => setImportModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.md }]}>
              Selected file will be encrypted with AES-256 and removed from normal storage.
            </Text>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {realAvailableFiles.length === 0 ? (
                <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', marginVertical: 20 }]}>
                  No files found on storage.
                </Text>
              ) : (
                realAvailableFiles.map((file) => (
                  <TouchableOpacity
                    key={file.path}
                    style={[styles.sampleImportRow, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => handleImportFile(file.path, file.name)}
                  >
                    <Text style={[typography.labelMedium, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Plus size={16} color={colors.primary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <Button
              title="Close"
              variant="secondary"
              onPress={() => setImportModalVisible(false)}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBtn: {
    padding: spacing.xs,
  },
  lockScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lockIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIndicatorRow: {
    flexDirection: 'row',
    gap: spacing.base,
    marginTop: spacing.xl,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  fingerprintOptionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 270,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
  },
  fingerprintOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypad: {
    width: 260,
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keypadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.sm,
  },
  vaultScroll: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  statusToast: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  categoryPills: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  catPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  vaultItemCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  vaultItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vaultThumbWrapper: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultVidWrapper: {
    width: 48,
    height: 48,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultMediaThumb: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
  },
  vaultPlayOverlayBadge: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultDocThumb: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  vaultDocTag: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  itemInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  actionIconBtn: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  actionSheetBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    ...elevation.lg,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  actionOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  actionOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 360,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    ...elevation.lg,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sampleImportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  selectionTopActionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  selectionCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  selectionBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    ...elevation.lg,
  },
  bottomActionBtn: {
    flex: 1,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
  },
});
