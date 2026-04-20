/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link } from "react-router-dom";
import { Facebook, Mail, MapPin } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-aaj-dark text-white border-t border-white/5 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <Link to="/" className="group">
            <h3 className="font-display font-black text-sm md:text-base uppercase tracking-[0.2em] leading-tight text-white">
              Association des Architectes de Jerba
            </h3>
          </Link>

          <div className="flex items-center gap-6">
            <a
              href="https://www.facebook.com/Architectes.De.Jerba"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-aaj-royal transition-colors"
              aria-label="Facebook"
            >
              <Facebook size={18} aria-hidden="true" />
            </a>
            <a
              href="https://maps.app.goo.gl/o2tTP7b6z12DiUX56"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-aaj-royal transition-colors"
              aria-label="Voir notre adresse sur Google Maps"
            >
              <MapPin size={18} aria-hidden="true" />
            </a>
            <a
              href="mailto:architectes.de.djerba@gmail.com"
              className="text-white/60 hover:text-aaj-royal transition-colors"
              aria-label="Nous envoyer un email"
            >
              <Mail size={18} aria-hidden="true" />
            </a>
          </div>

          <div className="flex items-center gap-6">
            <Link
              to="/mentions-legales"
              className="text-white/60 hover:text-aaj-royal transition-colors text-[10px] font-black uppercase tracking-[2px]"
            >
              Mentions légales
            </Link>
            <p className="text-white/40 text-[9px] uppercase font-black tracking-[3px]">
              © {new Date().getFullYear()} AAJ
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
