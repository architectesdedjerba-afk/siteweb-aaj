/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight i18n system (no external deps).
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Locale = 'fr' | 'ar' | 'en';

const STORAGE_KEY = 'aaj_locale';

type Translations = Record<string, Record<Locale, string>>;

export const translations: Translations = {
  'nav.home': { fr: 'Accueil', ar: 'الرئيسية', en: 'Home' },
  'nav.about': { fr: 'À Propos', ar: 'حول', en: 'About' },
  'nav.events': { fr: 'Évènements', ar: 'الأحداث', en: 'Events' },
  'nav.partners': { fr: 'Partenaires', ar: 'الشركاء', en: 'Partners' },
  'nav.members': { fr: 'Connexion', ar: 'تسجيل الدخول', en: 'Login' },
  'nav.legal': { fr: 'Mentions légales', ar: 'الإشعار القانوني', en: 'Legal Notice' },

  'home.tagline': { fr: "Association des Architectes de Jerba", ar: 'جمعية مهندسي جربة المعماريين', en: 'Association of Architects of Jerba' },
  'home.hero.title1': { fr: "L'excellence", ar: 'التميز', en: 'Architectural' },
  'home.hero.title2': { fr: 'Architecturale', ar: 'المعماري', en: 'Excellence' },
  'home.hero.title3': { fr: 'à Djerba.', ar: 'في جربة.', en: 'in Djerba.' },

  'common.back': { fr: 'Retour', ar: 'العودة', en: 'Back' },
  'common.submit': { fr: 'Envoyer', ar: 'إرسال', en: 'Submit' },
  'common.loading': { fr: 'Chargement…', ar: 'جارٍ التحميل…', en: 'Loading…' },
  'common.error': { fr: 'Une erreur est survenue.', ar: 'حدث خطأ.', en: 'An error occurred.' },

  'footer.copyright': { fr: 'Tous droits réservés.', ar: 'جميع الحقوق محفوظة.', en: 'All rights reserved.' },
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'fr',
  setLocale: () => {},
  t: (k) => k,
  dir: 'ltr',
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && ['fr', 'ar', 'en'].includes(saved)) {
        setLocaleState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  };

  const t = (key: string): string => {
    return translations[key]?.[locale] ?? key;
  };

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
