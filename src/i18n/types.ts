export type InterfaceLanguage = 'zh-CN' | 'en';
export type LanguagePreference = 'auto' | InterfaceLanguage;
export interface LanguageState { preference: LanguagePreference; language: InterfaceLanguage; systemLanguage: InterfaceLanguage }
export interface LanguageAPI {
  state(): Promise<LanguageState>;
  set(preference: LanguagePreference): Promise<LanguageState>;
  onState(handler: (state: LanguageState) => void): () => void;
}
