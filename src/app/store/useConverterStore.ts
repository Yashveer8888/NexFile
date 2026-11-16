import { create } from 'zustand';
import {
  SupportedConversionFormat,
  ConversionTask,
} from '../../types/pdf';
import { converterService } from '../../services/converter/converterService';

interface ConverterState {
  tasks: ConversionTask[];
  history: ConversionTask[];
  isConverting: boolean;

  addTask: (
    sourcePath: string,
    sourceFormat: SupportedConversionFormat,
    targetFormat: SupportedConversionFormat,
    size?: number
  ) => Promise<string>;

  startBatchConversion: () => Promise<void>;
  clearCompleted: () => void;
  removeTask: (id: string) => void;
}

export const useConverterStore = create<ConverterState>((set, get) => ({
  tasks: [],
  history: [
    {
      id: 'task_hist_1',
      sourcePath: '/storage/emulated/0/Download/Project_Specification_2026.pdf',
      sourceName: 'Project_Specification_2026.pdf',
      sourceFormat: 'pdf',
      targetFormat: 'docx',
      status: 'completed',
      progress: 1.0,
      outputPath: '/storage/emulated/0/Documents/Converted/Project_Specification_2026.docx',
      timestamp: Date.now() - 3600000,
      size: 2450000,
    },
    {
      id: 'task_hist_2',
      sourcePath: '/storage/emulated/0/DCIM/Camera/IMG_20261115_102045.jpg',
      sourceName: 'IMG_20261115_102045.jpg',
      sourceFormat: 'jpg',
      targetFormat: 'pdf',
      status: 'completed',
      progress: 1.0,
      outputPath: '/storage/emulated/0/Documents/Converted/IMG_20261115_102045.pdf',
      timestamp: Date.now() - 7200000,
      size: 4890000,
    },
  ],
  isConverting: false,

  addTask: async (sourcePath, sourceFormat, targetFormat, size) => {
    const fileName = sourcePath.split('/').pop() || 'document';
    const newTask: ConversionTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sourcePath,
      sourceName: fileName,
      sourceFormat,
      targetFormat,
      status: 'pending',
      progress: 0,
      timestamp: Date.now(),
      size: size || 1024 * 1024,
    };

    set((state) => ({ tasks: [...state.tasks, newTask] }));
    return newTask.id;
  },

  startBatchConversion: async () => {
    const { tasks } = get();
    const pendingTasks = tasks.filter((t) => t.status === 'pending');
    if (pendingTasks.length === 0) return;

    set({ isConverting: true });

    for (const task of pendingTasks) {
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === task.id ? { ...t, status: 'converting', progress: 0.2 } : t
        ),
      }));

      try {
        const outputPath = await converterService.convert(
          task.sourcePath,
          task.sourceFormat,
          task.targetFormat,
          '/storage/emulated/0/Documents/Converted',
          (progress) => {
            set((state) => ({
              tasks: state.tasks.map((t) =>
                t.id === task.id ? { ...t, progress } : t
              ),
            }));
          }
        );

        const updatedTask: ConversionTask = {
          ...task,
          status: 'completed',
          progress: 1.0,
          outputPath,
        };

        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== task.id),
          history: [updatedTask, ...state.history],
        }));
      } catch (err: any) {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === task.id
              ? { ...t, status: 'error', error: err?.message || 'Conversion failed' }
              : t
          ),
        }));
      }
    }

    set({ isConverting: false });
  },

  clearCompleted: () => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.status === 'pending' || t.status === 'converting'),
    }));
  },

  removeTask: (id: string) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      history: state.history.filter((h) => h.id !== id),
    }));
  },
}));

