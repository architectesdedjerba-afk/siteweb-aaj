/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link } from "react-router-dom";
import { Facebook, Mail, MapPin, ArrowUpRight } from "lucide-react";
import { Marquee } from "./motion";

const NAV_LINKS = [
  { label: "Accueil", path: "/" },
  { label: "L'AAJ", path: "/aaj" },
  { label: "Évènements", path: "/evennements" },
  { label: "Partenaires", path: "/partenaires" },
  { label: "Emplois", path: "/emplois" },
];

const MARQUEE_WORDS = [
  "Architecture",
  "Patrimoine",
  "Djerba",
  "Innovation",
  "Communauté",
  "Excellence",
];

export const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-aaj-night text-white border-t border-white/10 overflow-hidden">
      {/* Ambient gradient halo */}
      <div
        aria-hidden="true"
        className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(0,229,255,0.25) 0%, transparent 70%)",
        }}
      />

      {/* Marquee word band */}
      <div className="relative border-b border-white/10 py-10">
        <Marquee duration={50}>
          {MARQUEE_WORDS.map((w, i) => (
            <span
              key={i}
              className="text-5xl md:text-7xl font-display font-bold uppercase tracking-tighter px-8 text-white/10 whitespace-nowrap select-none"
            >
              {w} <span className="text-aaj-cyan">/</span>
            </span>
          ))}
        </Marquee>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-12 gap-12">
        <div className="md:col-span-5 space-y-6">
          <Link to="/" className="inline-block">
            <span className="font-display font-bold text-5xl tracking-tighter text-white">
              AA<span className="text-aaj-cyan aaj-text-glow-cyan">J</span>
            </span>
          </Link>
          <p className="text-white/60 text-sm leading-relaxed max-w-md">
            L'Association des Architectes de Jerba — un collectif engagé pour la préservation du patrimoine et la promotion d'une architecture contemporaine respectueuse de l'identité djerbienne.
          </p>
          <div className="flex items-center gap-3 pt-4">
            <a
              href="mailto:architectes.de.djerba@gmail.com"
              className="group w-11 h-11 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-aaj-cyan hover:border-aaj-cyan transition-all"
              aria-label="Email"
            >
              <Mail size={16} aria-hidden="true" />
            </a>
            <a
              href="https://maps.app.goo.gl/o2tTP7b6z12DiUX56"
              target="_blank"
              rel="noopener noreferrer"
              className="group w-11 h-11 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-aaj-cyan hover:border-aaj-cyan transition-all"
              aria-label="Localisation Google Maps"
            >
              <MapPin size={16} aria-hidden="true" />
            </a>
            <a
              href="https://www.facebook.com/Architectes.De.Jerba"
              target="_blank"
              rel="noopener noreferrer"
              className="group w-11 h-11 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-aaj-cyan hover:border-aaj-cyan transition-all"
              aria-label="Facebook"
            >
              <Facebook size={16} aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="md:col-span-3">
          <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-cyan mb-6">
            Navigation
          </h3>
          <ul className="space-y-3">
            {NAV_LINKS.map((l) => (
              <li key={l.path}>
                <Link
                  to={l.path}
                  className="text-sm text-white/70 hover:text-white transition-colors aaj-link-underline inline-flex items-center gap-2"
                >
                  {l.label}
                  <ArrowUpRight size={14} className="opacity-0 -translate-x-1 group-hover:opacity-100 transition-all" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-4">
          <h3 className="text-[10px] font-black uppercase tracking-[3px] text-aaj-cyan mb-6">
            Rejoignez-nous
          </h3>
          <ul className="space-y-3">
            <li>
              <Link
                to="/demander-adhesion"
                className="text-sm text-white/70 hover:text-white transition-colors aaj-link-underline"
              >
                Demande d'adhésion
              </Link>
            </li>
            <li>
              <Link
                to="/devenir-partenaire"
                className="text-sm text-white/70 hover:text-white transition-colors aaj-link-underline"
              >
                Devenir partenaire
              </Link>
            </li>
            <li>
              <Link
                to="/inscription-evenement"
                className="text-sm text-white/70 hover:text-white transition-colors aaj-link-underline"
              >
                S'inscrire à un évènement
              </Link>
            </li>
            <li>
              <Link
                to="/mentions-legales"
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                Mentions légales
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[10px] uppercase tracking-[3px] font-black">
          <span className="text-white/40">
            © {year} — Association des Architectes de Jerba
          </span>
          <span className="text-white/40">
            Djerba <span className="text-aaj-cyan">/</span> Tunisie
          </span>
        </div>
      </div>
    </footer>
  );
};
