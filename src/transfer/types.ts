import type { ProjectFile } from '../model/types';

export interface ImportEntry { id: string; name: string; path: string | null; text: string; error: string }
export interface ImportBatch { entries: ImportEntry[]; ignored: number; warnings: string[] }
export type ImportStrategy = 'merge' | 'replace' | 'keep';
export type ConflictChoice = 'current' | 'incoming';
export interface ImportChoice { id: string; path: string; strategy: ImportStrategy; selected: boolean; preferred: ConflictChoice; conflicts: Record<string, ConflictChoice> }
export interface TransferAPI {
  import(kind: 'files' | 'folder'): Promise<ImportBatch | null>;
  export(projectId: string, files: ProjectFile[], format: 'yaml' | 'zip', assets: boolean): Promise<string | null>;
}
