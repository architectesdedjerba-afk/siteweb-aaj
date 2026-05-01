/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link, useLocation } from "react-router-dom";
import { UserCircle, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/AuthContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./notifications/NotificationBell";

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const isAuthed = Boolean(user && profile);
  const reduce = useReducedMotion();

  const { scrollY } = useScroll();
  const navHeight = useTransform(scrollY, [0, 80], [72, 56]);
  const navBlur = useTransform(scrollY, [0, 80], [6, 14]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
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
    { name: t("nav.jobs"), path: "/emplois" },
  ];

  return (
    <motion.nav
      style={{
        height: reduce ? 64 : navHeight,
        backdropFilter: reduce ? "blur(10px)" : (navBlur as any).get
          ? undefined
          : undefined,
      }}
      className={`fixed top-0 left-0 right-0 z-[150] border-b transition-colors duration-500 ${
        scrolled
          ? "bg-aaj-night/80 backdrop-blur-xl border-white/10"
          : "bg-aaj-night/40 backdrop-blur-lg border-transparent"
      }`}
      aria-label="Navigation principale"
    >
      <div
        className={`h-full ${
          location.pathname.startsWith("/espace-adherents")
            ? "w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10"
            : "max-w-7xl mx-auto px-6"
        }`}
      >
        <div className="flex justify-between items-center h-full">
          <Link to="/" className="flex items-center gap-1 group" aria-label="Accueil AAJ">
            <span
              className={`font-display font-bold tracking-tighter text-white transition-all duration-500 ${
                scrolled ? "text-lg" : "text-2xl"
              }`}
            >
              AA<span className="text-aaj-cyan aaj-text-glow-cyan">J</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  aria-current={active ? "page" : undefined}
                  className="relative px-4 py-2 group"
                >
                  <span
                    className={`text-[11px] font-bold uppercase tracking-[2.5px] transition-colors ${
                      active ? "text-aaj-cyan" : "text-white/70 group-hover:text-white"
                    }`}
                  >
                    {link.name}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="aaj-nav-active"
                      className="absolute bottom-0 left-2 right-2 h-px bg-aaj-cyan"
                      style={{ boxShadow: "0 0 8px rgba(0,229,255,0.8)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 bottom-0 h-px bg-white/20 origin-right scale-x-0 group-hover:origin-left group-hover:scale-x-100 transition-transform duration-500"
                  />
                </Link>
              );
            })}
            <div className="ml-3 pl-3 border-l border-white/10 flex items-center gap-3">
              <LanguageSwitcher />
              {isAuthed && <NotificationBell />}
              <Link
                to="/espace-adherents"
                className="group relative inline-flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-[2.5px] text-aaj-night bg-aaj-cyan rounded-full overflow-hidden hover:bg-white transition-colors"
              >
                <UserCircle size={14} aria-hidden="true" />
                <span>{t("nav.members")}</span>
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -z-0 bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </Link>
            </div>
          </div>

          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
              className="text-white/80 hover:text-aaj-cyan p-2 transition-colors"
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
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden bg-aaj-night/95 backdrop-blur-xl border-b border-white/10 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={`block py-3 px-2 text-base font-bold uppercase tracking-widest border-l-2 transition-all ${
                      location.pathname === link.path
                        ? "text-aaj-cyan border-aaj-cyan"
                        : "text-white/80 border-transparent hover:text-white hover:border-white/30"
                    }`}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}
              <div className="pt-3 border-t border-white/10 mt-3 flex items-center gap-3">
                <LanguageSwitcher />
                {isAuthed && <NotificationBell variant="mobile" />}
              </div>
              <Link
                to="/espace-adherents"
                onClick={() => setIsOpen(false)}
                className="mt-3 flex items-center justify-center gap-3 bg-aaj-cyan text-aaj-night px-6 py-4 rounded-full text-sm font-black uppercase tracking-widest"
              >
                <UserCircle size={20} aria-hidden="true" />
                <span>{t("nav.members")}</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};
