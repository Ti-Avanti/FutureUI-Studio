import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import { useStudio } from '../state/store';
import { capabilities } from '../model/validate';

(self as any).MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });
monaco.languages.register({ id: 'yaml' });
monaco.languages.setMonarchTokensProvider('yaml', { tokenizer: { root: [[/#.*$/, 'comment'], [/^\s*[\w.-]+(?=\s*:)/, 'key'], [/"[^"\\]*(?:\\.[^"\\]*)*"|'[^']*'/, 'string'], [/\b(true|false|null)\b/, 'keyword'], [/\b\d+(\.\d+)?\b/, 'number'], [/[{}\[\],:]/, 'delimiter']] } });
monaco.languages.registerCompletionItemProvider('yaml', { provideCompletionItems: (model, position) => { const word = model.getWordUntilPosition(position); return { suggestions: capabilities.core_fields.map(key => ({ label: key, kind: monaco.languages.CompletionItemKind.Property, insertText: `${key}: `, range: { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn } })) }; } });
monaco.editor.defineTheme('studio', { base: 'vs-dark', inherit: true, rules: [{ token: 'key', foreground: '9CC3D5' }, { token: 'string', foreground: 'A5C99A' }, { token: 'comment', foreground: '69747D' }], colors: { 'editor.background': '#1d2026', 'editorLineNumber.foreground': '#4c5562', 'editor.selectionBackground': '#344e5b', 'editor.lineHighlightBackground': '#242831' } });
export function CodeEditor() {
  const { project, active, replace } = useStudio();
  const file = project?.files.find(f => f.path === active);
  return <Editor height="100%" language="yaml" theme="studio" path={`studio:///${project?.id}/${active}`} value={file?.text ?? ''} onChange={value => { if (file && value !== undefined) replace(active, value, '编辑 YAML'); }} options={{ fontSize: 12, lineHeight: 21, fontFamily: 'Cascadia Code, Consolas, monospace', minimap: { enabled: false }, padding: { top: 18 }, scrollBeyondLastLine: false, wordWrap: 'on', tabSize: 2, automaticLayout: true, smoothScrolling: true, renderWhitespace: 'selection' }}/ >;
}
