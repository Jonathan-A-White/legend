// src/settings/useAppearance.ts: puts the Theme and Text size settings on the page: a data-theme and a data-text-size on <html>,
// which src/index.css turns into colours and a root font size (every size in the app is rem, so the text scales as a whole).
import { useEffect } from 'react';
import { useSettings } from './useSettings';

export function useAppearance(): void {
  const settings = useSettings();
  const theme = settings?.theme;
  const textSize = settings?.textSize;
  useEffect(() => {
    const root = document.documentElement;
    if (typeof theme === 'string') root.dataset.theme = theme;
    if (typeof textSize === 'string') root.dataset.textSize = textSize;
  }, [theme, textSize]);
}
