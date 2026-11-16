import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Cloud,
  Server,
  FolderSync,
  Plus,
  ShieldCheck,
  ChevronRight,
  HardDrive,
  Globe,
  Wifi,
  Download,
  Upload,
  X,
  Check,
  Folder,
  FileText,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useCloudStore } from '../../app/store/useCloudStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { formatBytes } from '../../utils/formatters';
import { CloudConnection, CloudProtocol, RemoteFileItem } from '../../types/cloud';

export const CloudScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    connections,
    activeConnection,
    remoteFiles,
    isLoading,
    loadConnections,
    addConnection,
    removeConnection,
    browseConnection,
    downloadFile,
  } = useCloudStore();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [browseModalVisible, setBrowseModalVisible] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<CloudProtocol>('gdrive');
  const [connectionName, setConnectionName] = useState('');
  const [hostInput, setHostInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [statusToast, setStatusToast] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const handleCreateConnection = async () => {
    try {
      await addConnection({
        name: connectionName.trim() || `${selectedProtocol.toUpperCase()} Drive`,
        protocol: selectedProtocol,
        host: hostInput.trim() || undefined,
        username: usernameInput.trim() || undefined,
      });
      setAddModalVisible(false);
      setConnectionName('');
      setHostInput('');
      setUsernameInput('');
      setStatusToast('Connection added successfully');
      setTimeout(() => setStatusToast(null), 3000);
    } catch (e) {
      console.warn('Add connection error:', e);
    }
  };

  const handleOpenConnection = async (conn: CloudConnection) => {
    await browseConnection(conn, '/');
    setBrowseModalVisible(true);
  };

  const handleDownload = async (file: RemoteFileItem) => {
    try {
      const dest = await downloadFile(file.path);
      setStatusToast(`Downloaded: ${file.name}`);
      setTimeout(() => setStatusToast(null), 3000);
    } catch (e) {
      console.warn('Download error:', e);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header
        title="Cloud & Network"
        subtitle="Remote Storage & Sync"
        showThemeToggle
        rightActions={
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setAddModalVisible(true)}
          >
            <Plus size={20} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {statusToast && (
          <View style={[styles.statusToast, { backgroundColor: colors.primaryLight }]}>
            <Text style={[typography.labelMedium, { color: colors.primary }]}>{statusToast}</Text>
          </View>
        )}

        {/* Active Connections */}
        <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
          Active Connections ({connections.length})
        </Text>

        {connections.map((conn) => (
          <Card
            key={conn.id}
            style={styles.providerCard}
            onPress={() => handleOpenConnection(conn)}
          >
            <View style={styles.providerRow}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}20` }]}>
                {conn.protocol === 'sftp' || conn.protocol === 'ftp' ? (
                  <Server size={24} color={colors.primary} />
                ) : conn.protocol === 'smb' ? (
                  <Wifi size={24} color={colors.primary} />
                ) : conn.protocol === 'webdav' ? (
                  <Globe size={24} color={colors.primary} />
                ) : (
                  <Cloud size={24} color={colors.primary} />
                )}
              </View>

              <View style={styles.providerInfo}>
                <View style={styles.nameRow}>
                  <Text style={[typography.labelLarge, { color: colors.text }]}>{conn.name}</Text>
                  <Badge label="Connected" color={colors.success} backgroundColor={colors.successBackground} />
                </View>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  {conn.username ? `${conn.username}@` : ''}{conn.host || conn.protocol.toUpperCase()}
                </Text>
                {conn.quotaTotal && conn.quotaUsed && (
                  <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                    {formatBytes(conn.quotaUsed)} of {formatBytes(conn.quotaTotal)}
                  </Text>
                )}
              </View>

              <ChevronRight size={18} color={colors.textMuted} />
            </View>
          </Card>
        ))}

        {/* Security Notice */}
        <View style={[styles.securityNotice, { backgroundColor: colors.surfaceVariant }]}>
          <ShieldCheck size={20} color={colors.primary} />
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 10, flex: 1 }]}>
            All network credentials, SSH keys, and tokens are encrypted via hardware-backed Android Keystore.
          </Text>
        </View>
      </ScrollView>

      {/* Add Connection Modal */}
      <Modal visible={addModalVisible} transparent animationType="fade">
        <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeader}>
              <Text style={[typography.h3, { color: colors.text }]}>Add Storage</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Protocol Picker */}
            <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: spacing.sm }]}>PROTOCOL</Text>
            <View style={styles.protoRow}>
              {(['gdrive', 'onedrive', 'dropbox', 'sftp', 'webdav', 'smb'] as const).map((proto) => {
                const isSelected = selectedProtocol === proto;
                return (
                  <TouchableOpacity
                    key={proto}
                    style={[
                      styles.protoPill,
                      {
                        backgroundColor: isSelected ? colors.primaryLight : colors.surfaceVariant,
                        borderColor: isSelected ? colors.primary : 'transparent',
                      },
                    ]}
                    onPress={() => setSelectedProtocol(proto)}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: isSelected ? colors.primary : colors.text, textTransform: 'uppercase' },
                      ]}
                    >
                      {proto}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={[styles.dialogInput, typography.bodyMedium, { color: colors.text, backgroundColor: colors.surfaceVariant, borderColor: colors.border, marginTop: spacing.md }]}
              placeholder="Connection Name (e.g. My Nextcloud)"
              placeholderTextColor={colors.textMuted}
              value={connectionName}
              onChangeText={setConnectionName}
            />

            {(selectedProtocol === 'sftp' || selectedProtocol === 'ftp' || selectedProtocol === 'webdav' || selectedProtocol === 'smb') && (
              <>
                <TextInput
                  style={[styles.dialogInput, typography.bodyMedium, { color: colors.text, backgroundColor: colors.surfaceVariant, borderColor: colors.border, marginTop: spacing.sm }]}
                  placeholder="Host / Server IP"
                  placeholderTextColor={colors.textMuted}
                  value={hostInput}
                  onChangeText={setHostInput}
                />
                <TextInput
                  style={[styles.dialogInput, typography.bodyMedium, { color: colors.text, backgroundColor: colors.surfaceVariant, borderColor: colors.border, marginTop: spacing.sm }]}
                  placeholder="Username / Account"
                  placeholderTextColor={colors.textMuted}
                  value={usernameInput}
                  onChangeText={setUsernameInput}
                />
              </>
            )}

            <View style={styles.dialogButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setAddModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Connect"
                variant="primary"
                onPress={handleCreateConnection}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Remote File Browser Modal */}
      {activeConnection && (
        <Modal visible={browseModalVisible} animationType="slide" onRequestClose={() => setBrowseModalVisible(false)}>
          <View style={[styles.browserContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
            <View style={[styles.browserHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setBrowseModalVisible(false)} style={styles.headerBtn}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.browserTitleGroup}>
                <Text style={[typography.h4, { color: colors.text }]} numberOfLines={1}>
                  {activeConnection.name}
                </Text>
                <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
                  Remote Directory: /
                </Text>
              </View>
            </View>

            <FlatList
              data={remoteFiles}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: spacing.base }}
              renderItem={({ item }) => (
                <Card style={styles.remoteFileCard}>
                  <View style={styles.remoteRow}>
                    <View style={[styles.remoteIconBox, { backgroundColor: item.isDirectory ? `${colors.folderColor}20` : `${colors.primary}15` }]}>
                      {item.isDirectory ? (
                        <Folder size={20} color={colors.folderColor} fill={colors.folderColor} />
                      ) : (
                        <FileText size={20} color={colors.primary} />
                      )}
                    </View>

                    <View style={styles.remoteFileInfo}>
                      <Text style={[typography.labelMedium, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                        {item.isDirectory ? 'Folder' : formatBytes(item.size)}
                      </Text>
                    </View>

                    {!item.isDirectory && (
                      <TouchableOpacity
                        style={styles.downloadBtn}
                        onPress={() => handleDownload(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Download size={18} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              )}
            />
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  statusToast: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  providerCard: {
    marginBottom: spacing.md,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.sm,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
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
  protoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  protoPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  dialogInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  browserContainer: {
    flex: 1,
  },
  browserHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  browserTitleGroup: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  remoteFileCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  remoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  remoteIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteFileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  downloadBtn: {
    padding: spacing.xs,
  },
});
