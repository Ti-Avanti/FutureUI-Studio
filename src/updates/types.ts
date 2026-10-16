export type UpdatePhase = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'unsupported' | 'error';
export interface UpdateState {
  revision: number;
  phase: UpdatePhase;
  currentVersion: string;
  distribution: 'installed' | 'portable' | 'directory' | 'development' | 'unsupported';
  autoCheck: boolean;
  releaseUrl: string;
  nextVersion: string;
  releaseName: string;
  releaseDate: string;
  releaseNotes: string;
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
  lastChecked: number | null;
  cancelling: boolean;
  error: string;
}
export interface UpdatesAPI {
  state(): Promise<UpdateState>;
  check(): Promise<UpdateState>;
  download(): Promise<UpdateState>;
  cancel(): Promise<UpdateState>;
  install(): Promise<UpdateState>;
  autoCheck(value: boolean): Promise<UpdateState>;
  onState(handler: (state: UpdateState) => void): () => void;
  onOpen(handler: () => void): () => void;
}
