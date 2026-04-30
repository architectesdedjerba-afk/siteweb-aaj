/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin editors for the public-facing pages (Home, About, Partners).
 * Each editor loads `config/page*` on mount, renders an editable form,
 * and saves back through the existing helpers in `lib/pageContent`.
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Save } from 'lucide-react';
import {
  DEFAULT_PAGE_HOME,
  DEFAULT_PAGE_ABOUT,
  DEFAULT_PAGE_PARTNERS,
  loadPageHome,
  loadPageAbout,
  loadPagePartners,
  savePageHome,
  savePageAbout,
  savePagePartners,
  type PageHomeContent,
  type PageAboutContent,
  type PagePartnersContent,
  type PartnerIconKey,
} from '../../lib/pageContent';

// ----------------------------------------------------------------------
// shared building blocks
// ----------------------------------------------------------------------

const labelCls = 'text-[10px] uppercase font-black tracking-widest text-aaj-gray block mb-2';
const inputCls =
  'w-full bg-slate-50 border border-aaj-border rounded px-4 py-3 text-xs font-bold focus:outline-none focus:border-aaj-royal';
const sectionCls = 'border border-aaj-border rounded p-6 space-y-5 bg-white';
const sectionTitleCls = 'text-sm font-black uppercase tracking-widest text-aaj-dark';

type Banner = { type: 'success' | 'error'; text: string } | null;

const Field = ({
  label,
  value,
  onChange,
  textarea,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  rows?: number;
}) => (
  <div>
    <label className={labelCls}>{label}</label>
    {textarea ? (
      <textarea
        rows={rows ?? 3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} resize-none`}
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    )}
  </div>
);

const SaveButton = ({
  saving,
  banner,
}: {
  saving: boolean;
  banner: Banner;
}) => (
  <div className="space-y-4">
    {banner && (
      <div
        className={`p-4 rounded border text-[11px] font-bold uppercase tracking-widest ${
          banner.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}
      >
        {banner.text}
      </div>
    )}
    <button
      type="submit"
      disabled={saving}
      className="inline-flex items-center gap-3 bg-aaj-dark text-white px-10 py-4 rounded font-black uppercase tracking-[2px] text-[11px] hover:bg-aaj-royal transition-all disabled:opacity-60"
    >
      <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
    </button>
  </div>
);

const Header = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div>
    <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-2 block">
      {eyebrow}
    </span>
    <h2 className="text-2xl font-black uppercase tracking-tighter text-aaj-dark">{title}</h2>
  </div>
);

const Loading = () => (
  <div className="text-[11px] uppercase tracking-widest text-aaj-gray font-bold">Chargement…</div>
);

const motionWrap = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};

// ----------------------------------------------------------------------
// HomePageEditor
// ----------------------------------------------------------------------

export const HomePageEditor = () => {
  const [content, setContent] = useState<PageHomeContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  useEffect(() => {
    let cancelled = false;
    loadPageHome().then((c) => {
      if (!cancelled) setContent(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content) return;
    try {
      setSaving(true);
      await savePageHome(content);
      setBanner({ type: 'success', text: "Page d'accueil mise à jour." });
      setTimeout(() => setBanner(null), 3000);
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message ?? 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  if (!content) {
    return (
      <motion.div key="admin-page-home" {...motionWrap} className="space-y-8">
        <Header eyebrow="Pages publiques" title="Page d'Accueil" />
        <Loading />
      </motion.div>
    );
  }

  const set = <K extends keyof PageHomeContent>(key: K, val: PageHomeContent[K]) =>
    setContent((c) => (c ? { ...c, [key]: val } : c));

  return (
    <motion.div key="admin-page-home" {...motionWrap} className="space-y-8">
      <Header eyebrow="Pages publiques" title="Page d'Accueil" />
      <p className="text-[11px] uppercase tracking-widest text-aaj-gray font-bold max-w-2xl leading-relaxed">
        Modifiez les textes affichés sur la page d'accueil du site public. Les valeurs vides
        reviendront aux textes par défaut au prochain rechargement.
      </p>

      <form onSubmit={submit} className="space-y-6 max-w-3xl">
        {/* Hero */}
        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>Section Hero</h3>
          <Field label="Surtitre" value={content.hero.eyebrow} onChange={(v) => set('hero', { ...content.hero, eyebrow: v })} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Titre — ligne 1" value={content.hero.titleLine1} onChange={(v) => set('hero', { ...content.hero, titleLine1: v })} />
            <Field label="Titre — mot mis en avant" value={content.hero.titleHighlight} onChange={(v) => set('hero', { ...content.hero, titleHighlight: v })} />
            <Field label="Titre — ligne 3" value={content.hero.titleLine3} onChange={(v) => set('hero', { ...content.hero, titleLine3: v })} />
          </div>
          <Field label="Sous-titre" value={content.hero.subtitle} onChange={(v) => set('hero', { ...content.hero, subtitle: v })} textarea />
          <Field label="Texte du bouton" value={content.hero.ctaLabel} onChange={(v) => set('hero', { ...content.hero, ctaLabel: v })} />
        </div>

        {/* Stats */}
        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>Statistiques (4 chiffres)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content.stats.map((s, i) => (
              <div key={i} className="border border-aaj-border rounded p-4 space-y-3 bg-slate-50/50">
                <Field label={`Valeur #${i + 1}`} value={s.value} onChange={(v) => {
                  const next = [...content.stats];
                  next[i] = { ...next[i], value: v };
                  set('stats', next);
                }} />
                <Field label={`Libellé #${i + 1}`} value={s.label} onChange={(v) => {
                  const next = [...content.stats];
                  next[i] = { ...next[i], label: v };
                  set('stats', next);
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Events */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <h3 className={sectionTitleCls}>Aperçu Évènements</h3>
            <button
              type="button"
              onClick={() => set('events', [...content.events, { d: '', m: '', t: '', loc: '' }])}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-aaj-royal hover:text-aaj-dark"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
          <Field label="Titre du bloc" value={content.eventsTitle} onChange={(v) => set('eventsTitle', v)} />
          {content.events.map((ev, i) => (
            <div key={i} className="border border-aaj-border rounded p-4 space-y-3 bg-slate-50/50 relative">
              <button
                type="button"
                onClick={() => set('events', content.events.filter((_, j) => j !== i))}
                className="absolute top-3 right-3 text-aaj-gray hover:text-red-500"
                aria-label="Supprimer"
              >
                <Trash2 size={14} />
              </button>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jour" value={ev.d} onChange={(v) => {
                  const next = [...content.events]; next[i] = { ...next[i], d: v }; set('events', next);
                }} />
                <Field label="Mois (3 lettres)" value={ev.m} onChange={(v) => {
                  const next = [...content.events]; next[i] = { ...next[i], m: v }; set('events', next);
                }} />
              </div>
              <Field label="Titre" value={ev.t} onChange={(v) => {
                const next = [...content.events]; next[i] = { ...next[i], t: v }; set('events', next);
              }} />
              <Field label="Lieu / horaire" value={ev.loc} onChange={(v) => {
                const next = [...content.events]; next[i] = { ...next[i], loc: v }; set('events', next);
              }} />
            </div>
          ))}
          <Field label="Texte du lien « voir tous »" value={content.eventsCta} onChange={(v) => set('eventsCta', v)} />
        </div>

        {/* Partenariats preview */}
        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>Bloc Partenariats</h3>
          <Field label="Titre du bloc" value={content.sponsorsTitle} onChange={(v) => set('sponsorsTitle', v)} />
          <div className="grid grid-cols-3 gap-3">
            {content.sponsors.map((s, i) => (
              <Field key={i} label={`Niveau #${i + 1}`} value={s.name} onChange={(v) => {
                const next = [...content.sponsors]; next[i] = { name: v }; set('sponsors', next);
              }} />
            ))}
          </div>
          <Field label="Phrase de remerciement" value={content.sponsorsBlurb} onChange={(v) => set('sponsorsBlurb', v)} textarea />
          <Field label="Texte du lien" value={content.sponsorsCta} onChange={(v) => set('sponsorsCta', v)} />
        </div>

        {/* Bottom CTA */}
        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>Bandeau d'appel à l'action</h3>
          <Field label="Surtitre" value={content.cta.eyebrow} onChange={(v) => set('cta', { ...content.cta, eyebrow: v })} />
          <Field label="Titre" value={content.cta.title} onChange={(v) => set('cta', { ...content.cta, title: v })} textarea />
          <Field label="Texte du bouton" value={content.cta.buttonLabel} onChange={(v) => set('cta', { ...content.cta, buttonLabel: v })} />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setContent(DEFAULT_PAGE_HOME)}
            className="text-[10px] uppercase font-black tracking-widest text-aaj-gray hover:text-aaj-royal"
          >
            Réinitialiser aux valeurs par défaut
          </button>
          <SaveButton saving={saving} banner={banner} />
        </div>
      </form>
    </motion.div>
  );
};

// ----------------------------------------------------------------------
// AboutPageEditor
// ----------------------------------------------------------------------

export const AboutPageEditor = () => {
  const [content, setContent] = useState<PageAboutContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  useEffect(() => {
    let cancelled = false;
    loadPageAbout().then((c) => {
      if (!cancelled) setContent(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content) return;
    try {
      setSaving(true);
      await savePageAbout(content);
      setBanner({ type: 'success', text: 'Page « À propos » mise à jour.' });
      setTimeout(() => setBanner(null), 3000);
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message ?? 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  if (!content) {
    return (
      <motion.div key="admin-page-about" {...motionWrap} className="space-y-8">
        <Header eyebrow="Pages publiques" title="Page À Propos" />
        <Loading />
      </motion.div>
    );
  }

  const set = <K extends keyof PageAboutContent>(key: K, val: PageAboutContent[K]) =>
    setContent((c) => (c ? { ...c, [key]: val } : c));

  return (
    <motion.div key="admin-page-about" {...motionWrap} className="space-y-8">
      <Header eyebrow="Pages publiques" title="Page À Propos" />

      <form onSubmit={submit} className="space-y-6 max-w-3xl">
        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>En-tête</h3>
          <Field label="Surtitre" value={content.header.eyebrow} onChange={(v) => set('header', { ...content.header, eyebrow: v })} />
          <Field label="Titre" value={content.header.title} onChange={(v) => set('header', { ...content.header, title: v })} />
          <Field label="Sous-titre" value={content.header.subtitle} onChange={(v) => set('header', { ...content.header, subtitle: v })} textarea />
        </div>

        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>Statistiques (4 chiffres)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content.stats.map((s, i) => (
              <div key={i} className="border border-aaj-border rounded p-4 space-y-3 bg-slate-50/50">
                <Field label={`Valeur #${i + 1}`} value={s.value} onChange={(v) => {
                  const next = [...content.stats]; next[i] = { ...next[i], value: v }; set('stats', next);
                }} />
                <Field label={`Libellé #${i + 1}`} value={s.label} onChange={(v) => {
                  const next = [...content.stats]; next[i] = { ...next[i], label: v }; set('stats', next);
                }} />
              </div>
            ))}
          </div>
        </div>

        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>Notre Mission</h3>
          <Field label="Titre" value={content.mission.title} onChange={(v) => set('mission', { ...content.mission, title: v })} />
          <Field label="Texte" value={content.mission.content} onChange={(v) => set('mission', { ...content.mission, content: v })} textarea rows={5} />
        </div>

        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <h3 className={sectionTitleCls}>Nos Objectifs</h3>
            <button
              type="button"
              onClick={() => set('objectives', { ...content.objectives, items: [...content.objectives.items, ''] })}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-aaj-royal hover:text-aaj-dark"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
          <Field label="Titre" value={content.objectives.title} onChange={(v) => set('objectives', { ...content.objectives, title: v })} />
          {content.objectives.items.map((it, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1">
                <Field label={`Objectif #${i + 1}`} value={it} onChange={(v) => {
                  const next = [...content.objectives.items]; next[i] = v;
                  set('objectives', { ...content.objectives, items: next });
                }} />
              </div>
              <button
                type="button"
                onClick={() => set('objectives', { ...content.objectives, items: content.objectives.items.filter((_, j) => j !== i) })}
                className="mt-7 text-aaj-gray hover:text-red-500"
                aria-label="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>Citation sur l'image</h3>
          <Field label="Phrase" value={content.imageQuote} onChange={(v) => set('imageQuote', v)} textarea />
        </div>

        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>Bloc Bureau Exécutif</h3>
          <Field label="Surtitre" value={content.bureau.eyebrow} onChange={(v) => set('bureau', { ...content.bureau, eyebrow: v })} />
          <Field label="Titre" value={content.bureau.title} onChange={(v) => set('bureau', { ...content.bureau, title: v })} />
          <Field label="Description" value={content.bureau.description} onChange={(v) => set('bureau', { ...content.bureau, description: v })} textarea rows={4} />
        </div>

        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <h3 className={sectionTitleCls}>Chronologie des Bureaux</h3>
            <button
              type="button"
              onClick={() => set('history', { ...content.history, items: [...content.history.items, { period: '', president: '' }] })}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-aaj-royal hover:text-aaj-dark"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
          <Field label="Surtitre" value={content.history.eyebrow} onChange={(v) => set('history', { ...content.history, eyebrow: v })} />
          <Field label="Titre" value={content.history.title} onChange={(v) => set('history', { ...content.history, title: v })} />
          <Field label="Description" value={content.history.description} onChange={(v) => set('history', { ...content.history, description: v })} textarea />
          {content.history.items.map((it, i) => (
            <div key={i} className="border border-aaj-border rounded p-4 space-y-3 bg-slate-50/50 relative">
              <button
                type="button"
                onClick={() => set('history', { ...content.history, items: content.history.items.filter((_, j) => j !== i) })}
                className="absolute top-3 right-3 text-aaj-gray hover:text-red-500"
                aria-label="Supprimer"
              >
                <Trash2 size={14} />
              </button>
              <Field label="Période" value={it.period} onChange={(v) => {
                const next = [...content.history.items]; next[i] = { ...next[i], period: v };
                set('history', { ...content.history, items: next });
              }} />
              <Field label="Administration" value={it.president} onChange={(v) => {
                const next = [...content.history.items]; next[i] = { ...next[i], president: v };
                set('history', { ...content.history, items: next });
              }} />
            </div>
          ))}
          <Field label="Légende (carte sombre)" value={content.history.legend} onChange={(v) => set('history', { ...content.history, legend: v })} textarea />
        </div>

        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>Titre de clôture</h3>
          <Field label="Phrase finale" value={content.closingTitle} onChange={(v) => set('closingTitle', v)} textarea />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setContent(DEFAULT_PAGE_ABOUT)}
            className="text-[10px] uppercase font-black tracking-widest text-aaj-gray hover:text-aaj-royal"
          >
            Réinitialiser aux valeurs par défaut
          </button>
          <SaveButton saving={saving} banner={banner} />
        </div>
      </form>
    </motion.div>
  );
};

// ----------------------------------------------------------------------
// PartnersPageEditor
// ----------------------------------------------------------------------

const PARTNER_ICONS: { value: PartnerIconKey; label: string }[] = [
  { value: 'trophy', label: 'Trophée' },
  { value: 'star', label: 'Étoile' },
  { value: 'shield', label: 'Bouclier' },
];

export const PartnersPageEditor = () => {
  const [content, setContent] = useState<PagePartnersContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  useEffect(() => {
    let cancelled = false;
    loadPagePartners().then((c) => {
      if (!cancelled) setContent(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content) return;
    try {
      setSaving(true);
      await savePagePartners(content);
      setBanner({ type: 'success', text: 'Page « Partenaires » mise à jour.' });
      setTimeout(() => setBanner(null), 3000);
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message ?? 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  if (!content) {
    return (
      <motion.div key="admin-page-partners" {...motionWrap} className="space-y-8">
        <Header eyebrow="Pages publiques" title="Page Partenaires" />
        <Loading />
      </motion.div>
    );
  }

  const set = <K extends keyof PagePartnersContent>(key: K, val: PagePartnersContent[K]) =>
    setContent((c) => (c ? { ...c, [key]: val } : c));

  return (
    <motion.div key="admin-page-partners" {...motionWrap} className="space-y-8">
      <Header eyebrow="Pages publiques" title="Page Partenaires" />

      <form onSubmit={submit} className="space-y-6 max-w-3xl">
        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>En-tête</h3>
          <Field label="Surtitre" value={content.header.eyebrow} onChange={(v) => set('header', { ...content.header, eyebrow: v })} />
          <Field label="Titre" value={content.header.title} onChange={(v) => set('header', { ...content.header, title: v })} />
          <Field label="Sous-titre" value={content.header.subtitle} onChange={(v) => set('header', { ...content.header, subtitle: v })} textarea />
        </div>

        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <h3 className={sectionTitleCls}>Catégories de Sponsoring</h3>
            <button
              type="button"
              onClick={() => set('categories', [...content.categories, { name: '', iconKey: 'trophy', price: '', benefits: [] }])}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-aaj-royal hover:text-aaj-dark"
            >
              <Plus size={14} /> Ajouter une catégorie
            </button>
          </div>
          <Field label="Titre du bloc" value={content.categoriesTitle} onChange={(v) => set('categoriesTitle', v)} />
          <div className="space-y-4">
            <label className={labelCls}>Catégorie mise en avant (« recommandé »)</label>
            <select
              value={content.featuredIndex}
              onChange={(e) => set('featuredIndex', Number(e.target.value))}
              className={inputCls}
            >
              {content.categories.map((c, i) => (
                <option key={i} value={i}>
                  #{i + 1} — {c.name || '(sans nom)'}
                </option>
              ))}
            </select>
          </div>
          {content.categories.map((cat, i) => (
            <div key={i} className="border border-aaj-border rounded p-4 space-y-3 bg-slate-50/50 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-aaj-royal">
                  Catégorie #{i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => set('categories', content.categories.filter((_, j) => j !== i))}
                  className="text-aaj-gray hover:text-red-500"
                  aria-label="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nom" value={cat.name} onChange={(v) => {
                  const next = [...content.categories]; next[i] = { ...next[i], name: v }; set('categories', next);
                }} />
                <div>
                  <label className={labelCls}>Icône</label>
                  <select
                    value={cat.iconKey}
                    onChange={(e) => {
                      const next = [...content.categories];
                      next[i] = { ...next[i], iconKey: e.target.value as PartnerIconKey };
                      set('categories', next);
                    }}
                    className={inputCls}
                  >
                    {PARTNER_ICONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Field label="Sous-titre" value={cat.price} onChange={(v) => {
                const next = [...content.categories]; next[i] = { ...next[i], price: v }; set('categories', next);
              }} />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Avantages</label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...content.categories];
                      next[i] = { ...next[i], benefits: [...next[i].benefits, ''] };
                      set('categories', next);
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-aaj-royal hover:text-aaj-dark"
                  >
                    + Ajouter
                  </button>
                </div>
                {cat.benefits.map((b, bi) => (
                  <div key={bi} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={b}
                      onChange={(e) => {
                        const next = [...content.categories];
                        const benefits = [...next[i].benefits];
                        benefits[bi] = e.target.value;
                        next[i] = { ...next[i], benefits };
                        set('categories', next);
                      }}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...content.categories];
                        next[i] = { ...next[i], benefits: next[i].benefits.filter((_, k) => k !== bi) };
                        set('categories', next);
                      }}
                      className="text-aaj-gray hover:text-red-500"
                      aria-label="Supprimer l'avantage"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>Bloc « Ils nous font confiance »</h3>
          <Field label="Titre" value={content.trustTitle} onChange={(v) => set('trustTitle', v)} />
          <div>
            <label className={labelCls}>Nombre d'emplacements logos « à venir »</label>
            <input
              type="number"
              min={0}
              max={20}
              value={content.trustPlaceholders}
              onChange={(e) => set('trustPlaceholders', Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
              className={inputCls}
            />
          </div>
        </div>

        <div className={sectionCls}>
          <h3 className={sectionTitleCls}>Bandeau d'appel à l'action</h3>
          <Field label="Titre" value={content.cta.title} onChange={(v) => set('cta', { ...content.cta, title: v })} />
          <Field label="Description" value={content.cta.description} onChange={(v) => set('cta', { ...content.cta, description: v })} textarea />
          <Field label="Texte du bouton" value={content.cta.buttonLabel} onChange={(v) => set('cta', { ...content.cta, buttonLabel: v })} />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setContent(DEFAULT_PAGE_PARTNERS)}
            className="text-[10px] uppercase font-black tracking-widest text-aaj-gray hover:text-aaj-royal"
          >
            Réinitialiser aux valeurs par défaut
          </button>
          <SaveButton saving={saving} banner={banner} />
        </div>
      </form>
    </motion.div>
  );
};
