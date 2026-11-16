import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Sparkles,
  Send,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertCircle,
  FileSearch,
  Check,
  X,
  History,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useAiStore } from '../../app/store/useAiStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatBytes } from '../../utils/formatters';
import { fileService } from '../../services/filesystem/fileService';

export const AiAssistantScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const { messages, isThinking, auditLogs, sendMessage, executeAction, clearChat } = useAiStore();

  const [inputText, setInputText] = useState('');
  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, isThinking]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isThinking) return;
    setInputText('');
    await sendMessage(text);
  };

  const promptSuggestions = [
    'Find all PDF files',
    'Find large files',
    'Identify duplicate files',
    'Organize Downloads by file type',
    'Summarize this PDF',
    'Check storage health',
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title="Local AI Assistant"
        subtitle="Zero-Cloud Offline Intelligence"
        showBack
        onBack={() => navigation.goBack()}
        showThemeToggle
        rightActions={
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setAuditModalVisible(true)}
          >
            <History size={20} color={colors.text} />
          </TouchableOpacity>
        }
      />

      {/* Zero-Cloud Privacy Notice Banner */}
      <View style={[styles.privacyBanner, { backgroundColor: colors.surfaceVariant }]}>
        <ShieldCheck size={16} color={colors.primary} />
        <Text style={[typography.labelSmall, { color: colors.textSecondary, marginLeft: 6 }]}>
          100% On-Device Processing • Zero Personal Data Transferred
        </Text>
      </View>

      {/* Chat Messages Stream */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.chatScroll}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <View
              key={msg.id}
              style={[
                styles.messageWrapper,
                isUser ? styles.userWrapper : styles.assistantWrapper,
              ]}
            >
              {!isUser && (
                <View style={[styles.aiAvatar, { backgroundColor: `${colors.primary}20` }]}>
                  <Sparkles size={16} color={colors.primary} />
                </View>
              )}

              <View
                style={[
                  styles.bubble,
                  isUser
                    ? [styles.userBubble, { backgroundColor: colors.primary }]
                    : [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.cardBorder }],
                ]}
              >
                <Text
                  style={[
                    typography.bodyMedium,
                    { color: isUser ? '#FFFFFF' : colors.text, lineHeight: 22 },
                  ]}
                >
                  {msg.text}
                </Text>

                {/* Matched Files Preview Card */}
                {msg.matchedFiles && msg.matchedFiles.length > 0 && (
                  <View style={styles.matchedFilesSection}>
                    {msg.matchedFiles.slice(0, 3).map((f) => (
                      <TouchableOpacity
                        key={f.id}
                        style={[styles.matchedFileChip, { backgroundColor: colors.surfaceVariant }]}
                        onPress={() => fileService.openFile(f.path)}
                      >
                        <FileText size={16} color={colors.primary} />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[typography.labelSmall, { color: colors.text }]} numberOfLines={1}>
                            {f.name}
                          </Text>
                          <Text style={[typography.labelSmall, { color: colors.textMuted, fontSize: 10 }]}>
                            {formatBytes(f.size)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Safe Action Execution Card */}
                {msg.actionRequest && (
                  <View style={[styles.actionCard, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                    <View style={styles.actionHeader}>
                      <AlertCircle size={16} color={colors.primary} />
                      <Text style={[typography.labelMedium, { color: colors.text, marginLeft: 6 }]}>
                        {msg.actionRequest.title}
                      </Text>
                    </View>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                      {msg.actionRequest.description}
                    </Text>

                    {msg.actionRequest.isExecuted ? (
                      <View style={styles.executedBanner}>
                        <CheckCircle2 size={16} color={colors.success} />
                        <Text style={[typography.labelSmall, { color: colors.success, marginLeft: 6 }]}>
                          Action Safely Completed
                        </Text>
                      </View>
                    ) : (
                      <Button
                        title="Proceed with Action"
                        size="sm"
                        variant="primary"
                        onPress={() => executeAction(msg.actionRequest!.id)}
                        style={{ marginTop: spacing.sm }}
                      />
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {isThinking && (
          <View style={[styles.messageWrapper, styles.assistantWrapper]}>
            <View style={[styles.aiAvatar, { backgroundColor: `${colors.primary}20` }]}>
              <Sparkles size={16} color={colors.primary} />
            </View>
            <View style={[styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                Analyzing files locally...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Prompt Suggestions Horizontal Pill Bar */}
      <View style={styles.suggestionsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
          {promptSuggestions.map((prompt) => (
            <TouchableOpacity
              key={prompt}
              style={[styles.suggestionPill, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
              onPress={() => sendMessage(prompt)}
            >
              <Text style={[typography.labelSmall, { color: colors.text }]}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Chat Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.textInput, typography.bodyMedium, { color: colors.text, backgroundColor: colors.surfaceVariant }]}
          placeholder="Ask local AI to find, organize, or explain..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.surfaceVariant }]}
          onPress={handleSend}
          disabled={!inputText.trim() || isThinking}
        >
          <Send size={18} color={inputText.trim() ? '#FFFFFF' : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Audit Log Modal */}
      <Modal visible={auditModalVisible} transparent animationType="slide" onRequestClose={() => setAuditModalVisible(false)}>
        <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeader}>
              <Text style={[typography.h3, { color: colors.text }]}>AI Security Audit Logs</Text>
              <TouchableOpacity onPress={() => setAuditModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
              Complete transparent log of all local query parser and tool actions.
            </Text>

            <ScrollView style={styles.auditScroll}>
              {auditLogs.map((log, idx) => (
                <Text key={idx} style={[typography.mono, { color: colors.textSecondary, fontSize: 11, marginVertical: 3 }]}>
                  {log}
                </Text>
              ))}
            </ScrollView>

            <Button
              title="Close Audit Log"
              variant="secondary"
              onPress={() => setAuditModalVisible(false)}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBtn: {
    padding: spacing.xs,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.base,
  },
  chatScroll: {
    padding: spacing.base,
    paddingBottom: spacing.lg,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  assistantWrapper: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 4,
  },
  bubble: {
    maxWidth: '82%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  userBubble: {
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  matchedFilesSection: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  matchedFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  actionCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  executedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  suggestionsBar: {
    paddingVertical: spacing.xs,
  },
  suggestionsScroll: {
    paddingHorizontal: spacing.base,
    gap: spacing.xs,
  },
  suggestionPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    height: 42,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: 0,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    maxWidth: 380,
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
  auditScroll: {
    maxHeight: 220,
    marginVertical: spacing.md,
  },
});
