import { create } from 'zustand';
import { AiChatMessage, AiActionRequest } from '../../types/ai';
import { aiAssistantService } from '../../services/ai/aiAssistantService';
import { fileService } from '../../services/filesystem/fileService';

interface AiState {
  messages: AiChatMessage[];
  isThinking: boolean;
  auditLogs: string[];

  sendMessage: (text: string) => Promise<void>;
  executeAction: (actionId: string) => Promise<void>;
  clearChat: () => void;
}

export const useAiStore = create<AiState>((set, get) => ({
  messages: [
    {
      id: 'welcome_msg',
      sender: 'assistant',
      text: 'Hello! I am your local, zero-cloud AI File Assistant. I can discover documents, analyze storage, identify duplicates, and summarize your files without your data ever leaving your phone.',
      timestamp: Date.now() - 60000,
    },
  ],
  isThinking: false,
  auditLogs: [],

  sendMessage: async (text: string) => {
    if (!text.trim()) return;

    const userMsg: AiChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, userMsg],
      isThinking: true,
    }));

    try {
      const response = await aiAssistantService.processQuery(text.trim());
      set((state) => ({
        messages: [...state.messages, response],
        isThinking: false,
        auditLogs: aiAssistantService.getAuditLogs(),
      }));
    } catch (e) {
      const errorMsg: AiChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I encountered an issue processing that local request.',
        timestamp: Date.now(),
      };
      set((state) => ({
        messages: [...state.messages, errorMsg],
        isThinking: false,
      }));
    }
  },

  executeAction: async (actionId: string) => {
    const { messages } = get();
    let actionToExecute: AiActionRequest | undefined;

    for (const msg of messages) {
      if (msg.actionRequest && msg.actionRequest.id === actionId) {
        actionToExecute = msg.actionRequest;
        break;
      }
    }

    if (!actionToExecute) return;

    // Execute requested safe action
    if (actionToExecute.type === 'cleanup') {
      for (const f of actionToExecute.affectedFiles) {
        await fileService.delete(f.path, true);
      }
    }

    aiAssistantService.logAudit(`ACTION EXECUTED: ${actionToExecute.title} on ${actionToExecute.affectedFiles.length} file(s).`);

    set((state) => ({
      messages: state.messages.map((m) =>
        m.actionRequest?.id === actionId
          ? {
              ...m,
              actionRequest: { ...m.actionRequest, isExecuted: true },
            }
          : m
      ),
      auditLogs: aiAssistantService.getAuditLogs(),
    }));
  },

  clearChat: () => {
    set({
      messages: [
        {
          id: `welcome_${Date.now()}`,
          sender: 'assistant',
          text: 'Conversation reset. How can I assist you with your files today?',
          timestamp: Date.now(),
        },
      ],
    });
  },
}));

