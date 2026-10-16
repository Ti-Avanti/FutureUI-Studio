import { create } from 'zustand';
import editor from '../../resources/i18n/editor.en.json';
import agent from '../../resources/i18n/agent.en.json';
import transfer from '../../resources/i18n/transfer.en.json';
import system from '../../resources/i18n/system.en.json';
import type { LanguageState, LanguagePreference } from './types';

const catalog: Record<string, string> = { ...editor, ...agent, ...transfer, ...system };
interface State extends LanguageState { saving: boolean; error: string }
export const useInterfaceLanguage = create<State>(() => ({ preference: 'auto', language: 'en', systemLanguage: 'en', saving: false, error: '' }));
let unsubscribe: (() => void) | undefined;

function apply(state: LanguageState) {
  useInterfaceLanguage.setState({ ...state, error: '' });
  document.documentElement.lang = state.language;
}

export async function initializeLanguage() {
  unsubscribe?.();
  unsubscribe = window.studio.language.onState(apply);
  apply(await window.studio.language.state());
}

export async function selectLanguage(preference: LanguagePreference) {
  if (useInterfaceLanguage.getState().saving) return;
  useInterfaceLanguage.setState({ saving: true, error: '' });
  try { apply(await window.studio.language.set(preference)); }
  catch (error) { useInterfaceLanguage.setState({ error: (error as Error).message }); }
  finally { useInterfaceLanguage.setState({ saving: false }); }
}

export function tr(message: string, ...values: unknown[]) {
  const text = useInterfaceLanguage.getState().language === 'en' ? catalog[message] ?? message : message;
  return text.replace(/\{(\d+)\}/g, (match, index) => Number(index) < values.length ? String(values[Number(index)]) : match);
}

export const interfaceLocale = () => useInterfaceLanguage.getState().language === 'en' ? 'en-US' : 'zh-CN';
export const englishMessage = (key: string) => catalog[key] ?? key;
