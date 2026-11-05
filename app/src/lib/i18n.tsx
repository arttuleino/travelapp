import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { MESSAGES, type Messages } from './translations';

export type Lang = keyof typeof MESSAGES;
export type MessageKey = keyof Messages;
export type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

/** Languages offered in Profile, in the order shown. `locale` drives date formatting. */
export const LANGUAGES: { code: Lang; name: string; locale: string }[] = [
  { code: 'fi', name: 'Suomi', locale: 'fi-FI' },
  { code: 'en', name: 'English', locale: 'en-GB' },
  { code: 'sv', name: 'Svenska', locale: 'sv-SE' },
  { code: 'de', name: 'Deutsch', locale: 'de-DE' },
  { code: 'de-AT', name: 'Deutsch (Österreich)', locale: 'de-AT' },
  { code: 'fr', name: 'Français', locale: 'fr-FR' },
];

const DEFAULT_LANG: Lang = 'fi';
const STORAGE_KEY = 'language';

export const localeOf = (lang: Lang) => LANGUAGES.find((l) => l.code === lang)?.locale ?? 'fi-FI';

/** The text for `key` in `lang` (Finnish if missing), with `{name}` placeholders filled from `params`. */
export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const text = MESSAGES[lang]?.[key] ?? MESSAGES[DEFAULT_LANG][key];
  return params ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m)) : text;
}

type I18n = { lang: Lang; locale: string; t: Translate; setLang: (lang: Lang) => void };

const I18nContext = createContext<I18n>({
  lang: DEFAULT_LANG,
  locale: localeOf(DEFAULT_LANG),
  t: (key, params) => translate(DEFAULT_LANG, key, params),
  setLang: () => {},
});

/** Keeps the chosen language on this device (AsyncStorage; localStorage in the browser). */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && saved in MESSAGES) setLangState(saved as Lang);
      })
      .catch(() => {});
  }, []);

  function setLang(next: Lang) {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }

  const value: I18n = { lang, locale: localeOf(lang), t: (key, params) => translate(lang, key, params), setLang };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
