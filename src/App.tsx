/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { MotionConfig, AnimatePresence, motion } from "motion/react";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ScrollToTop } from "./components/ScrollToTop";
import { CookieBanner } from "./components/CookieBanner";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { NotificationProvider } from "./lib/NotificationContext";
import { ToastProvider } from "./lib/toast";
import { I18nProvider } from "./lib/i18n";
import { pageTransition } from "./lib/motion";
import { ArrowUp, Loader2 } from "lucide-react";
import { Suspense, lazy, useState, useEffect } from "react";

/**
 * Pages chargées paresseusement — chacune se retrouve dans son propre chunk
 * Vite/Rollup, ce qui réduit drastiquement le bundle d'entrée. Comme nos
 * pages sont des exports nommés, on mappe `m.XxxPage` → `default` pour
 * satisfaire le contrat de `React.lazy`.
 */
const HomePage = lazy(() => import("./pages/Home").then((m) => ({ default: m.HomePage })));
const AboutPage = lazy(() => import("./pages/About").then((m) => ({ default: m.AboutPage })));
const NewsPage = lazy(() => import("./pages/News").then((m) => ({ default: m.NewsPage })));
const PartnersPage = lazy(() => import("./pages/Partners").then((m) => ({ default: m.PartnersPage })));
const JobsPage = lazy(() => import("./pages/Jobs").then((m) => ({ default: m.JobsPage })));
const MemberSpacePage = lazy(() =>
  import("./pages/MemberSpace").then((m) => ({ default: m.MemberSpacePage }))
);
const EventRegistrationPage = lazy(() =>
  import("./pages/EventRegistration").then((m) => ({ default: m.EventRegistrationPage }))
);
const MembershipApplicationPage = lazy(() =>
  import("./pages/MembershipApplication").then((m) => ({ default: m.MembershipApplicationPage }))
);
const PartnerApplicationPage = lazy(() =>
  import("./pages/PartnerApplication").then((m) => ({ default: m.PartnerApplicationPage }))
);
const ResetPasswordPage = lazy(() =>
  import("./pages/ResetPassword").then((m) => ({ default: m.ResetPasswordPage }))
);
const LegalNoticePage = lazy(() =>
  import("./pages/LegalNotice").then((m) => ({ default: m.LegalNoticePage }))
);
const NotFoundPage = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFoundPage })));

/**
 * Fallback minimal pour les chunks de page en cours de chargement.
 * Hauteur identique au viewport pour éviter un saut de layout pendant le
 * fetch. Marqué `aria-live` pour les lecteurs d'écran.
 */
function RouteLoader() {
  return (
    <div
      className="flex items-center justify-center min-h-[60vh] py-20"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="animate-spin text-aaj-royal" size={32} aria-label="Chargement" />
    </div>
  );
}

/**
 * Routes wrapped in AnimatePresence so each page transition fades in/out.
 * Extracted as a child component so we can call `useLocation()` inside
 * `<BrowserRouter>`. The motion wrapper is keyed on `pathname` to trigger
 * exit/enter on every route change.
 */
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={pageTransition.initial}
        animate={pageTransition.animate}
        exit={pageTransition.exit}
        transition={pageTransition.transition}
      >
        {/*
         * Suspense INSIDE le motion.div : si on le mettait au-dessus
         * d'AnimatePresence, son fallback remplacerait tout l'arbre des
         * routes pendant le fetch et tuerait l'animation de sortie de la
         * page précédente. Ici, l'exit anim joue jusqu'au bout, puis le
         * nouveau motion.div monte avec son propre boundary qui affiche
         * brièvement un loader si le chunk n'est pas encore chargé.
         */}
        <Suspense fallback={<RouteLoader />}>
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/aaj" element={<AboutPage />} />
            <Route path="/evennements" element={<NewsPage />} />
            <Route path="/partenaires" element={<PartnersPage />} />
            <Route path="/emplois" element={<JobsPage />} />
            <Route path="/espace-adherents" element={<MemberSpacePage />} />
            <Route path="/inscription-evenement" element={<EventRegistrationPage />} />
            <Route path="/demander-adhesion" element={<MembershipApplicationPage />} />
            <Route path="/devenir-partenaire" element={<PartnerApplicationPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/mentions-legales" element={<LegalNoticePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

// Chat bubble = bottom-6 (24px) + h-14 (56px) = 80px tall stack starting at
// the bottom edge. When the user is logged in, the back-to-top button must
// clear that stack so the two don't overlap in the bottom-right corner.
const CHAT_BUBBLE_RESERVED = 88; // 80px + 8px gap

function BackToTopButton() {
  const { user } = useAuth();
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(32);

  useEffect(() => {
    const baseOffset = user ? CHAT_BUBBLE_RESERVED : 32;
    const handleScroll = () => {
      setShowTopBtn(window.scrollY > 400);

      const footer = document.querySelector("footer");
      if (footer) {
        const rect = footer.getBoundingClientRect();
        const vh = window.innerHeight;
        setBottomOffset(rect.top < vh ? vh - rect.top + 20 : baseOffset);
      } else {
        setBottomOffset(baseOffset);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [user]);

  const goToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <button
      onClick={goToTop}
      style={{ bottom: `${bottomOffset}px` }}
      className={`fixed right-6 md:right-8 z-[100] w-12 h-12 bg-aaj-dark text-white border border-white/10 flex items-center justify-center transition-all hover:bg-aaj-royal ${
        showTopBtn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      }`}
      aria-label="Retour en haut"
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
            <BrowserRouter>
            <ScrollToTop />
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:bg-aaj-dark focus:text-white focus:px-6 focus:py-3 focus:text-[11px] focus:font-black focus:uppercase focus:tracking-[3px]"
            >
              Aller au contenu principal
            </a>
            <div className="flex flex-col min-h-screen selection:bg-aaj-royal selection:text-white bg-white">
              <Navbar />
              <main id="main-content" className="grow" tabIndex={-1}>
                <AnimatedRoutes />
              </main>
              <Footer />
              <CookieBanner />
              <BackToTopButton />
            </div>
            </BrowserRouter>
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
