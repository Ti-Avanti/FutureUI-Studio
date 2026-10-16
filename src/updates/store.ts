import { create } from 'zustand';
import { dirtyFiles, useStudio } from '../state/store';
import { useAgent } from '../agent/store';
import type { UpdateState } from './types';

interface UpdatesStore {
  state: UpdateState | null;
  initialized: boolean;
  open: boolean;
  preparing: boolean;
  error: string;
  dismissedVersion: string;
  initialize(): Promise<void>;
  show(check?: boolean): Promise<void>;
  close(): void;
  dismissNotice(): void;
  check(): Promise<void>;
  download(): Promise<void>;
  cancel(): Promise<void>;
  autoCheck(value: boolean): Promise<void>;
  install(): Promise<void>;
  openRelease(): Promise<void>;
}

export const useUpdates = create<UpdatesStore>((set, get) => {
  const receive = (state: UpdateState) => {
    if (!get().state || state.revision >= get().state!.revision) set({ state });
  };
  const perform = async (operation: () => Promise<UpdateState>) => {
    set({ error: '' });
    try { receive(await operation()); }
    catch (error) { set({ error: (error as Error).message }); }
  };
  return {
    state: null, initialized: false, open: false, preparing: false, error: '', dismissedVersion: '',
    initialize: async () => {
      if (get().initialized) return;
      set({ initialized: true });
      window.studio.updates.onState(receive);
      window.studio.updates.onOpen(() => { void get().show(); });
      await perform(window.studio.updates.state);
    },
    show: async (check = false) => {
      set({ open: true, error: '' });
      await get().initialize();
      if (check) await get().check();
    },
    close: () => { if (!get().preparing && get().state?.phase !== 'installing') set({ open: false, dismissedVersion: get().state?.nextVersion ?? '' }); },
    dismissNotice: () => set({ dismissedVersion: get().state?.nextVersion ?? '' }),
    check: () => perform(window.studio.updates.check),
    download: () => perform(window.studio.updates.download),
    cancel: () => perform(window.studio.updates.cancel),
    autoCheck: value => perform(() => window.studio.updates.autoCheck(value)),
    install: async () => {
      if (get().preparing) return;
      set({ preparing: true, error: '' });
      try {
        if (useAgent.getState().sessions.some(session => session.running)) throw Error('Agent 仍在执行任务，请等待完成或先停止任务');
        if (useStudio.getState().busy) throw Error('工程正在处理中，请稍候');
        if (dirtyFiles(useStudio.getState()).length) {
          await useStudio.getState().save();
          if (dirtyFiles(useStudio.getState()).length) throw Error(useStudio.getState().error || '工程未能全部保存，更新安装已取消');
        }
        await useAgent.getState().flush();
        if (dirtyFiles(useStudio.getState()).length) throw Error('工程又有新的修改，请保存后重新安装');
        receive(await window.studio.updates.install());
      } catch (error) { set({ error: (error as Error).message }); }
      finally { set({ preparing: false }); }
    },
    openRelease: async () => {
      const url = get().state?.releaseUrl;
      if (!url) return;
      try { await window.studio.openLink(url); }
      catch (error) { set({ error: (error as Error).message }); }
    },
  };
});
