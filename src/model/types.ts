export type PathKey = string | number;
export type Config = Record<string, any>;
export interface ProjectFile { path: string; text: string; hash: string | null }
export interface PixelImage { path: string; url: string }
export interface Project { id: string; name: string; root: string; files: ProjectFile[]; images: PixelImage[] }
export interface Origin { file: string; path: PathKey[] }
export interface Element extends Config { _origin: Origin; _key: string; children?: Element[] }
export interface Box { key: string; x: number; y: number; width: number; height: number; node: Element; depth: number; clip?: { x: number; y: number; width: number; height: number } }
export interface Issue { level: 'error' | 'warning' | 'info'; file: string; message: string; path?: PathKey[] }
export interface Preview { boxes: Box[]; width: number; height: number; theme: Config; title: string; issues: Issue[]; elements: Element[]; images: Record<string, string> }
export type Workspace = 'design' | 'interaction' | 'motion' | 'data' | 'assets' | 'publish';
export interface FileEdit { path: string; before: string | null; after: string | null }
export interface FileWrite { path: string; text: string | null; hash: string | null }
export interface Change { id: string; label: string; path: string; time: number; files: FileEdit[] }
export interface StudioAPI {
  updates: import('../updates/types').UpdatesAPI;
  transfer: import('../transfer/types').TransferAPI;
  history: import('../history/types').HistoryAPI;
  ai: import('../agent/types').AIAPI;
  bootstrap(): Promise<Project>;
  open(): Promise<Project | null>;
  create(): Promise<Project | null>;
  refresh(id: string): Promise<Project>;
  save(id: string, files: FileWrite[]): Promise<{ revision: string; files: { path: string; hash: string | null }[] }>;
  export(id: string, files: ProjectFile[]): Promise<string | null>;
  importImage(id: string): Promise<PixelImage | null>;
  reveal(id: string): Promise<string>;
  openLink(url:string):Promise<void>;
  server(settings: { host: string; port: number; password: string }, operation: string, player?: string, menu?: string): Promise<string>;
  dirty(value: boolean): void;
  window(action: string): void;
  onMenu(handler: (action: string) => void): () => void;
}
declare global { interface Window { studio: StudioAPI } }
export const keyOf = (origin: Origin) => `${origin.file}:${JSON.stringify(origin.path)}`;
