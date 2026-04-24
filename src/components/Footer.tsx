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
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          <div className="md:col-span-5 space-y-6">
            <Link to="/" className="inline-block group">
              <span className="font-display font-extrabold text-2xl tracking-widest text-white">
                AA<span className="text-aaj-royal">J</span>
              </span>
            </Link>
            <p className="text-white/60 text-sm leading-relaxed max-w-md">
              Association des Architectes de Jerba — Valoriser le patrimoine,
              accompagner la modernité et rassembler la profession autour de
              l'architecture insulaire.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://www.facebook.com/Architectes.De.Jerba"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-aaj-royal hover:bg-aaj-royal transition-all"
                aria-label="Facebook"
              >
                <Facebook size={16} aria-hidden="true" />
              </a>
              <a
                href="https://maps.app.goo.gl/o2tTP7b6z12DiUX56"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-aaj-royal hover:bg-aaj-royal transition-all"
                aria-label="Voir notre adresse sur Google Maps"
              >
                <MapPin size={16} aria-hidden="true" />
              </a>
              <a
                href="mailto:architectes.de.djerba@gmail.com"
                className="w-10 h-10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-aaj-royal hover:bg-aaj-royal transition-all"
                aria-label="Nous envoyer un email"
              >
                <Mail size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="md:col-span-3 space-y-6">
            <h3 className="text-[10px] uppercase tracking-[3px] font-black text-white/40">
              Navigation
            </h3>
            <ul className="space-y-3 text-sm">
              <li><Link to="/" className="text-white/70 hover:text-white transition-colors">Accueil</Link></li>
              <li><Link to="/aaj" className="text-white/70 hover:text-white transition-colors">L'AAJ</Link></li>
              <li><Link to="/evennements" className="text-white/70 hover:text-white transition-colors">Évènements</Link></li>
              <li><Link to="/partenaires" className="text-white/70 hover:text-white transition-colors">Partenaires</Link></li>
              <li><Link to="/espace-adherents" className="text-white/70 hover:text-white transition-colors">Espace adhérents</Link></li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-6">
            <h3 className="text-[10px] uppercase tracking-[3px] font-black text-white/40">
              Contact
            </h3>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3 text-white/70">
                <MapPin size={16} className="mt-0.5 text-aaj-royal shrink-0" aria-hidden="true" />
                <span>Djerba, Tunisie</span>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={16} className="mt-0.5 text-aaj-royal shrink-0" aria-hidden="true" />
                <a
                  href="mailto:architectes.de.djerba@gmail.com"
                  className="text-white/70 hover:text-white transition-colors break-all"
                >
                  architectes.de.djerba@gmail.com
                </a>
              </li>
            </ul>
            <div className="pt-2">
              <Link
                to="/demander-adhesion"
                className="inline-flex items-center gap-3 border border-white/20 px-6 py-3 text-[10px] font-black uppercase tracking-[3px] hover:bg-white hover:text-aaj-dark transition-all"
              >
                Demander mon adhésion
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-[10px] uppercase font-black tracking-[3px]">
            © {year} AAJ — Tous droits réservés
          </p>
          <div className="flex items-center gap-6">
            <Link
              to="/mentions-legales"
              className="text-white/60 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[2px]"
            >
              Mentions légales
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
