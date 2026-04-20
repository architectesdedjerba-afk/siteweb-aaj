/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const STORAGE_KEY = "aaj_cookie_consent_v1";

export const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (!v) setVisible(true);
    } catch {
      // localStorage unavailable (private mode)
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-desc"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[150] bg-aaj-dark text-white border border-white/10 shadow-2xl p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 id="cookie-title" className="text-xs font-black uppercase tracking-widest mb-2">Cookies essentiels</h2>
          <p id="cookie-desc" className="text-xs text-white/70 leading-relaxed mb-4">
            Nous utilisons uniquement des cookies techniques nécessaires au fonctionnement du site (authentification).
            Aucun suivi publicitaire.{" "}
            <Link to="/mentions-legales" className="underline hover:text-aaj-royal">En savoir plus</Link>.
          </p>
          <button
            onClick={accept}
            className="bg-aaj-royal text-white text-[10px] font-black uppercase tracking-[2px] px-6 py-3 hover:bg-white hover:text-aaj-dark transition-colors"
          >
            J'ai compris
          </button>
        </div>
        <button
          onClick={accept}
          aria-label="Fermer"
          className="text-white/60 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
