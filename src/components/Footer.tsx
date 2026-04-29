/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link } from "react-router-dom";
import { Facebook, Mail, MapPin } from "lucide-react";

export const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-aaj-dark text-white border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-display font-extrabold text-lg tracking-widest text-white">
            AA<span className="text-aaj-royal">J</span>
          </Link>
          <span className="text-white/40 text-[10px] uppercase font-black tracking-[3px]">
            © {year} — Tous droits réservés
          </span>
        </div>

        <div className="flex items-center gap-5">
          <a
            href="mailto:architectes.de.djerba@gmail.com"
            className="text-white/60 hover:text-white transition-colors"
            aria-label="Nous envoyer un email"
          >
            <Mail size={16} aria-hidden="true" />
          </a>
          <a
            href="https://maps.app.goo.gl/o2tTP7b6z12DiUX56"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white transition-colors"
            aria-label="Voir notre adresse sur Google Maps"
          >
            <MapPin size={16} aria-hidden="true" />
          </a>
          <a
            href="https://www.facebook.com/Architectes.De.Jerba"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white transition-colors"
            aria-label="Facebook"
          >
            <Facebook size={16} aria-hidden="true" />
          </a>
          <Link
            to="/mentions-legales"
            className="text-white/60 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[2px]"
          >
            Mentions légales
          </Link>
        </div>
      </div>
    </footer>
  );
};
