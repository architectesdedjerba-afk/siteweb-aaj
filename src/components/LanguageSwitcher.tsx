/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n, Locale } from "../lib/i18n";
import { Globe } from "lucide-react";

const LOCALES: { code: Locale; label: string }[] = [
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
  { code: "en", label: "EN" },
];

export const LanguageSwitcher = () => {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest" role="group" aria-label="Langue">
      <Globe size={12} className="text-aaj-gray mr-1" aria-hidden="true" />
      {LOCALES.map((l, i) => (
        <span key={l.code} className="flex items-center">
          {i > 0 && <span className="text-aaj-border mx-1" aria-hidden="true">·</span>}
          <button
            type="button"
            onClick={() => setLocale(l.code)}
            aria-pressed={locale === l.code}
            className={`transition-colors ${locale === l.code ? "text-aaj-royal" : "text-aaj-gray hover:text-aaj-dark"}`}
          >
            {l.label}
          </button>
        </span>
      ))}
    </div>
  );
};
