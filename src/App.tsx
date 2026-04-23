/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/Home';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollToTop } from './components/ScrollToTop';
import { CookieBanner } from './components/CookieBanner';
import { AuthProvider } from './lib/AuthContext';
import { ToastProvider } from './lib/toast';
import { I18nProvider } from './lib/i18n';
import { ArrowUp, Loader2 } from 'lucide-react';
import { useState, useEffect, lazy, Suspense } from 'react';
import { HelmetProvider } from 'react-helmet-async';

// Lazy-loaded routes : réduit le bundle initial, charge à la demande
const AboutPage = lazy(() => import('./pages/About').then((m) => ({ default: m.AboutPage })));
const NewsPage = lazy(() => import('./pages/News').then((m) => ({ default: m.NewsPage })));
const PartnersPage = lazy(() =>
  import('./pages/Partners').then((m) => ({ default: m.PartnersPage }))
);
const MemberSpacePage = lazy(() =>
  import('./pages/MemberSpace').then((m) => ({ default: m.MemberSpacePage }))
);
const EventRegistrationPage = lazy(() =>
  import('./pages/EventRegistration').then((m) => ({ default: m.EventRegistrationPage }))
);
const MembershipApplicationPage = lazy(() =>
  import('./pages/MembershipApplication').then((m) => ({ default: m.MembershipApplicationPage }))
);
const PartnerApplicationPage = lazy(() =>
  import('./pages/PartnerApplication').then((m) => ({ default: m.PartnerApplicationPage }))
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPassword').then((m) => ({ default: m.ResetPasswordPage }))
);
const LegalNoticePage = lazy(() =>
  import('./pages/LegalNotice').then((m) => ({ default: m.LegalNoticePage }))
);

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite">
    <Loader2 className="animate-spin text-aaj-royal" size={32} aria-hidden="true" />
    <span className="sr-only">Chargement de la page…</span>
  </div>
);

export default function App() {
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(32);

  useEffect(() => {
    const handleScroll = () => {
      setShowTopBtn(window.scrollY > 400);

      const footer = document.querySelector('footer');
      if (footer) {
        const rect = footer.getBoundingClientRect();
        const vh = window.innerHeight;
        setBottomOffset(rect.top < vh ? vh - rect.top + 20 : 32);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const goToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <I18nProvider>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <ScrollToTop />
                <div className="flex flex-col min-h-screen selection:bg-aaj-royal selection:text-white bg-white">
                  <Navbar />
                  <main id="main-content" className="grow" tabIndex={-1}>
                    <Suspense fallback={<PageLoader />}>
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
                      </Routes>
                    </Suspense>
                  </main>
                  <Footer />
                  <CookieBanner />

                  <button
                    onClick={goToTop}
                    style={{ bottom: `${bottomOffset}px` }}
                    className={`fixed right-6 md:right-8 z-[100] w-12 h-12 bg-aaj-dark text-white border border-white/10 flex items-center justify-center transition-all hover:bg-aaj-royal ${
                      showTopBtn
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-10 pointer-events-none'
                    }`}
                    aria-label="Retour en haut"
                  >
                    <ArrowUp size={20} aria-hidden="true" />
                  </button>
                </div>
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </I18nProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
