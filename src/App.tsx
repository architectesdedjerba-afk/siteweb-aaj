/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { HomePage } from "./pages/Home";
import { AboutPage } from "./pages/About";
import { NewsPage } from "./pages/News";
import { PartnersPage } from "./pages/Partners";
import { MemberSpacePage } from "./pages/MemberSpace";
import { EventRegistrationPage } from "./pages/EventRegistration";
import { MembershipApplicationPage } from "./pages/MembershipApplication";
import { PartnerApplicationPage } from "./pages/PartnerApplication";
import { ResetPasswordPage } from "./pages/ResetPassword";
import { LegalNoticePage } from "./pages/LegalNotice";
import { NotFoundPage } from "./pages/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ScrollToTop } from "./components/ScrollToTop";
import { CookieBanner } from "./components/CookieBanner";
import { AuthProvider } from "./lib/AuthContext";
import { NotificationProvider } from "./lib/NotificationContext";
import { ToastProvider } from "./lib/toast";
import { I18nProvider } from "./lib/i18n";
import { ArrowUp } from "lucide-react";
import { useState, useEffect } from "react";

export default function App() {
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(32);

  useEffect(() => {
    const handleScroll = () => {
      setShowTopBtn(window.scrollY > 400);

      const footer = document.querySelector("footer");
      if (footer) {
        const rect = footer.getBoundingClientRect();
        const vh = window.innerHeight;
        setBottomOffset(rect.top < vh ? vh - rect.top + 20 : 32);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const goToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <ErrorBoundary>
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
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/aaj" element={<AboutPage />} />
                  <Route path="/evennements" element={<NewsPage />} />
                  <Route path="/partenaires" element={<PartnersPage />} />
                  <Route path="/espace-adherents" element={<MemberSpacePage />} />
                  <Route path="/inscription-evenement" element={<EventRegistrationPage />} />
                  <Route path="/demander-adhesion" element={<MembershipApplicationPage />} />
                  <Route path="/devenir-partenaire" element={<PartnerApplicationPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/mentions-legales" element={<LegalNoticePage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </main>
              <Footer />
              <CookieBanner />

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
            </div>
            </BrowserRouter>
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
