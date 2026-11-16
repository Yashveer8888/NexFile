import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
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
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useVaultStore } from '../../app/store/useVaultStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatBytes, formatDate } from '../../utils/formatters';
import { VaultItem } from '../../types/vault';

export const PrivateVaultScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    isUnlocked,
    items,
    activeCategory,
    setActiveCategory,
    unlockWithPin,
    lockVault,
    setPin,
    importFileToVault,
    exportFileFromVault,
    deleteVaultItem,
  } = useVaultStore();

  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [changePinModalVisible, setChangePinModalVisible] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleKeyPress = (num: string) => {
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

  const handleBiometricUnlock = () => {
    // Biometric fingerprint simulation
    const success = unlockWithPin('1234');
    if (!success) setPinError(true);
  };

  const handleImportSample = async (samplePath: string) => {
    try {
      const item = await importFileToVault(samplePath, '1234');
      setImportModalVisible(false);
      setStatusMessage(`Encrypted & Imported: ${item.name}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.warn('Import error:', e);
    }
  };

  const handleExport = async (item: VaultItem) => {
    try {
      const exportedPath = await exportFileFromVault(item.id, '/storage/emulated/0/Documents', '1234');
      setStatusMessage(`Decrypted & Exported to Documents: ${item.name}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.warn('Export error:', e);
    }
  };

  const filteredItems = activeCategory === 'all'
    ? items
    : items.filter((i) => i.category === activeCategory);

  const importableSamples = [
    { name: 'Financial_Summary_2026.xlsx', path: '/storage/emulated/0/Download/Financial_Summary_2026.xlsx' },
    { name: 'IMG_20261115_091530.jpg', path: '/storage/emulated/0/DCIM/Camera/IMG_20261115_091530.jpg' },
    { name: 'VID_20261114_183022.mp4', path: '/storage/emulated/0/DCIM/Camera/VID_20261114_183022.mp4' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header
        title="Private Vault"
        subtitle={isUnlocked ? 'AES-256-GCM Unlocked' : 'Protected Storage'}
        showBack
        onBack={() => navigation.goBack()}
        showThemeToggle
        rightActions={
          isUnlocked ? (
            <TouchableOpacity onPress={lockVault} style={styles.headerBtn}>
              <Lock size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {!isUnlocked ? (
        /* PIN Keypad Screen */
        <View style={styles.lockScreen}>
          <View style={[styles.lockIconCircle, { backgroundColor: `${colors.vaultColor}20` }]}>
            <Lock size={36} color={colors.vaultColor} />
          </View>
          <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md }]}>
            Enter Vault PIN
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 4 }]}>
            Hardware-backed AES-256-GCM authenticated storage
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
              Incorrect PIN. (Default test PIN: 1234)
            </Text>
          )}

          {/* Numeric Keypad */}
          <View style={styles.keypad}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[styles.keypadButton, { backgroundColor: colors.surface }]}
                    onPress={() => handleKeyPress(num)}
                    activeOpacity={0.7}
                  >
                    <Text style={[typography.h2, { color: colors.text }]}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.keypadRow}>
              <TouchableOpacity
                style={[styles.keypadButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={handleBiometricUnlock}
              >
                <Fingerprint size={28} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.keypadButton, { backgroundColor: colors.surface }]}
                onPress={() => handleKeyPress('0')}
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
            {(['all', 'images', 'videos', 'documents'] as const).map((cat) => {
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
              Encrypted Files ({filteredItems.length})
            </Text>
            <Button
              title="Import File"
              size="sm"
              variant="primary"
              icon={<Plus size={14} color="#FFFFFF" />}
              onPress={() => setImportModalVisible(true)}
            />
          </View>

          {filteredItems.map((item) => (
            <Card key={item.id} style={styles.vaultItemCard}>
              <View style={styles.vaultItemRow}>
                <View style={[styles.itemIconCircle, { backgroundColor: `${colors.vaultColor}15` }]}>
                  {item.category === 'images' ? (
                    <ImageIcon size={20} color={colors.vaultColor} />
                  ) : item.category === 'videos' ? (
                    <Video size={20} color={colors.vaultColor} />
                  ) : (
                    <FileText size={20} color={colors.vaultColor} />
                  )}
                </View>

                <View style={styles.itemInfo}>
                  <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                    {formatBytes(item.size)} • Encrypted {formatDate(item.encryptedAt)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => handleExport(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Download size={18} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => deleteVaultItem(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}

      {/* Import Modal */}
      <Modal visible={importModalVisible} transparent animationType="fade">
        <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeader}>
              <Text style={[typography.h3, { color: colors.text }]}>Import to Vault</Text>
              <TouchableOpacity onPress={() => setImportModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.md }]}>
              Files will be encrypted with AES-256-GCM.
            </Text>

            {importableSamples.map((sample) => (
              <TouchableOpacity
                key={sample.path}
                style={[styles.sampleImportRow, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => handleImportSample(sample.path)}
              >
                <Text style={[typography.labelMedium, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                  {sample.name}
                </Text>
                <Plus size={16} color={colors.primary} />
              </TouchableOpacity>
            ))}

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
  itemIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  actionIconBtn: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
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
});
