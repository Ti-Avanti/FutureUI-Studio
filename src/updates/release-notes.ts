export function localizedReleaseNotes(text: string, language: string) {
  const sections = text.match(/^## 简体中文\s*\n([\s\S]*?)\n## English\s*\n([\s\S]*)$/);
  return sections ? sections[language === 'en' ? 2 : 1].trim() : text;
}
