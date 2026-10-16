import { tr } from '../i18n';
import { create } from 'zustand';
import { useStudio } from '../state/store';
import type { ImportBatch, ImportChoice } from './types';

interface TransferState {
  open: boolean; mode: 'import' | 'export'; projectId: string; busy: boolean; error: string;
  batch: ImportBatch | null; choices: ImportChoice[]; selectedId: string;
  show(mode: 'import' | 'export'): void; close(): void;
  choose(kind: 'files' | 'folder'): Promise<void>;
  change(id: string, patch: Partial<ImportChoice>): void;
  set(values: Partial<TransferState>): void;
}

export const useTransfer = create<TransferState>((set, get) => ({
  open: false, mode: 'import', projectId: '', busy: false, error: '', batch: null, choices: [], selectedId: '', set,
  show: mode => {
    const project = useStudio.getState().project; if (!project) return;
    const changed = get().projectId !== project.id;
    set({ open: true, mode, projectId: project.id, error: '', ...(changed ? { batch: null, choices: [], selectedId: '' } : {}) });
  },
  close: () => { if (!get().busy) set({ open: false }); },
  change: (id, patch) => set(s => ({ choices: s.choices.map(c => c.id === id ? { ...c, ...patch } : c), error: '' })),
  choose: async kind => {
    if (get().busy) return;
    set({ busy: true, error: '' });
    const projectId = get().projectId;
    try {
      const batch = await window.studio.transfer.import(kind); if (!batch) return;
      if (useStudio.getState().project?.id !== projectId) throw Error(tr("工程已切换，请重新选择导入文件"));
      const active = useStudio.getState().active;
      const folder = active.includes('/') ? active.slice(0, active.lastIndexOf('/')) : 'menus';
      const choices: ImportChoice[] = batch.entries.map(e => ({ id: e.id, path: e.path ?? `${folder}/${e.name}`, strategy: 'merge', selected: !e.error, preferred: 'current', conflicts: {} }));
      set({ batch, choices, selectedId: choices[0]?.id ?? '' });
    } catch (error) { set({ error: (error as Error).message }); }
    finally { set({ busy: false }); }
  },
}));
