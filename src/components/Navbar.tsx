/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link, useLocation } from "react-router-dom";
import { UserCircle, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "../lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.about"), path: "/aaj" },
    { name: t("nav.events"), path: "/evennements" },
    { name: t("nav.partners"), path: "/partenaires" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-16 border-b transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-lg border-aaj-border shadow-sm"
          : "bg-white/70 backdrop-blur-lg border-transparent"
      }`}
      aria-label="Navigation principale"
    >
      <div className="max-w-7xl mx-auto px-6 h-full">
        <div className="flex justify-between items-center h-full">
          <Link to="/" className="flex items-center gap-1 group" aria-label="Accueil AAJ">
            <span className="font-display font-extrabold text-xl tracking-widest text-aaj-dark">AA<span className="text-aaj-royal">J</span></span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  aria-current={active ? "page" : undefined}
                  className={`text-[13px] font-bold uppercase tracking-widest transition-all hover:text-aaj-royal ${
                    active ? "text-aaj-royal border-b-2 border-aaj-royal pb-1" : "text-aaj-dark"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
            <LanguageSwitcher />
            <Link
              to="/espace-adherents"
              className="flex items-center gap-2 bg-aaj-dark text-white px-5 py-2.5 rounded text-[13px] font-bold uppercase tracking-widest hover:bg-aaj-royal transition-all"
            >
              <UserCircle size={16} className="bg-white rounded-full text-aaj-dark p-0.5" aria-hidden="true" />
              <span>{t("nav.members")}</span>
            </Link>
          </div>

          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
              className="text-slate-600 hover:text-aaj-dark p-2"
            >
              {isOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-100 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className="block text-lg font-medium text-slate-900 hover:text-aaj-royal py-2"
                >
                  {link.name}
                </Link>
              ))}
              <div className="pt-2">
                <LanguageSwitcher />
              </div>
              <Link
                to="/espace-adherents"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 bg-aaj-dark text-white px-6 py-4 rounded-xl text-lg font-medium"
              >
                <UserCircle size={24} aria-hidden="true" />
                <span>{t("nav.members")}</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
