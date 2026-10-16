import { createContext, useContext, useMemo } from 'react';
import type { Preview } from '../model/types';
import { compile } from '../preview/compile';
import { useStudio } from '../state/store';

const empty: Preview = { boxes: [], width: 576, height: 324, theme: {}, title: '', issues: [], elements: [], images: {} };
const PreviewContext = createContext(empty);
export const usePreview = () => useContext(PreviewContext);
export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const { project, active, locale, variables, time, previewOverrides } = useStudio();
  const value = useMemo(() => {
    if (!project) return empty;
    const files=new Map(project.files.map(f=>[f.path,f]));
    for(const [path,text] of Object.entries(previewOverrides??{}))files.set(path,{path,text,hash:files.get(path)?.hash??null});
    try { return compile({...project,files:[...files.values()]}, active, locale, variables, time); }
    catch (error) { return { ...empty, issues: [{ level: 'error' as const, file: active, message: (error as Error).message }] }; }
  }, [project, active, locale, variables, time, previewOverrides]);
  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}
