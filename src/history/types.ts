export interface SavedNode { id: string; time: number; label: string; count: number; size: number }
export interface HistoryAPI {
  list(projectId: string): Promise<SavedNode[]>;
  read(projectId: string, nodeId: string): Promise<{ path: string; text: string }[]>;
}
