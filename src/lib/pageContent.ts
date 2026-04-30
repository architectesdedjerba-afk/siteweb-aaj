/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Editable content for the three public-facing pages
 * (Home, About, Partners). Stored in the `config` collection at IDs
 * `pageHome`, `pageAbout`, `pagePartners`. Public read is allowed
 * server-side; writes require super-admin / config_manage.
 */

import { doc, getDoc, setDoc, serverTimestamp, db } from './firebase';

// ---------------- shared shapes ----------------

export interface StatItem {
  value: string;
  label: string;
}

// ---------------- Home ----------------

export interface HomeEventPreview {
  d: string;
  m: string;
  t: string;
  loc: string;
}

export interface HomeSponsor {
  name: string;
}

export interface PageHomeContent {
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleHighlight: string;
    titleLine3: string;
    subtitle: string;
    ctaLabel: string;
  };
  stats: StatItem[];
  eventsTitle: string;
  events: HomeEventPreview[];
  eventsCta: string;
  sponsorsTitle: string;
  sponsors: HomeSponsor[];
  sponsorsBlurb: string;
  sponsorsCta: string;
  cta: {
    eyebrow: string;
    title: string;
    buttonLabel: string;
  };
}

export const DEFAULT_PAGE_HOME: PageHomeContent = {
  hero: {
    eyebrow: 'Association des Architectes de Jerba',
    titleLine1: "L'excellence",
    titleHighlight: 'Architecturale',
    titleLine3: 'à Djerba.',
    subtitle:
      "L'AAJ s'engage pour une architecture qui respecte l'âme millénaire de l'île tout en embrassant l'innovation contemporaine.",
    ctaLabel: "Découvrir l'AAJ",
  },
  stats: [
    { value: '120+', label: 'Architectes adhérents' },
    { value: '15', label: "Années d'engagement" },
    { value: '30+', label: 'Projets patrimoniaux' },
    { value: '50+', label: 'Évènements organisés' },
  ],
  eventsTitle: 'Évènements',
  events: [
    { d: '22', m: 'Oct', t: "Colloque International d'Architecture", loc: 'Houmt Souk — 09:00' },
    { d: '15', m: 'Nov', t: 'Patrimoine & Modernité', loc: 'Centre Culturel de Jerba' },
  ],
  eventsCta: 'Tous les évènements',
  sponsorsTitle: 'Partenariats',
  sponsors: [{ name: 'Platine' }, { name: 'Or' }, { name: 'Argent' }],
  sponsorsBlurb:
    "L'AAJ remercie ses partenaires pour leur engagement constant envers le développement de notre profession.",
  sponsorsCta: 'Devenir Partenaire',
  cta: {
    eyebrow: 'Rejoignez le mouvement',
    title: "Façonnez l'avenir de l'architecture à Djerba.",
    buttonLabel: 'Devenir partenaire',
  },
};

// ---------------- About ----------------

export interface AboutHistoryEntry {
  period: string;
  president: string;
}

export interface PageAboutContent {
  header: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  stats: StatItem[];
  mission: {
    title: string;
    content: string;
  };
  objectives: {
    title: string;
    items: string[];
  };
  imageQuote: string;
  bureau: {
    eyebrow: string;
    title: string;
    description: string;
  };
  history: {
    eyebrow: string;
    title: string;
    description: string;
    items: AboutHistoryEntry[];
    legend: string;
  };
  closingTitle: string;
}

export const DEFAULT_PAGE_ABOUT: PageAboutContent = {
  header: {
    eyebrow: 'Manifeste',
    title: "À Propos de l'AAJ",
    subtitle: 'Engagement, Patrimoine et Innovation.',
  },
  stats: [
    { value: '120+', label: 'Architectes adhérents' },
    { value: '15', label: "Années d'engagement" },
    { value: '30+', label: 'Projets patrimoniaux' },
    { value: '50+', label: 'Évènements organisés' },
  ],
  mission: {
    title: 'Notre Mission',
    content:
      "L'Association des Architectes de Jerba (AAJ) œuvre pour la promotion de l'excellence architecturale et la préservation de l'identité unique de l'île. Nous croyons en une architecture durable qui dialogue avec l'histoire tout en répondant aux défis de demain.",
  },
  objectives: {
    title: 'Nos Objectifs',
    items: [
      'Protéger le patrimoine architectural jerbien (Menzels, Mosquées, Souks).',
      'Soutenir les jeunes architectes dans leur insertion professionnelle.',
      'Organiser des workshops et colloques internationaux.',
      'Collaborer avec les autorités pour un urbanisme maîtrisé.',
    ],
  },
  imageQuote: "L'architecture est l'expression de la culture.",
  bureau: {
    eyebrow: 'Gouvernance',
    title: 'Le Bureau Exécutif Actuel',
    description:
      "L'association est dirigée par un bureau de professionnels passionnés, élus par leurs pairs, engagés pour le rayonnement de Djerba.",
  },
  history: {
    eyebrow: 'Héritage',
    title: 'Chronologie des Bureaux',
    description:
      "Une succession de visions et d'engagements qui ont façonné l'histoire de l'association depuis sa fondation.",
    items: [
      { period: '2024 - Présent', president: 'Bureau Actuel' },
      { period: '2021 - 2023', president: 'Mandat Précédent' },
      { period: '2018 - 2020', president: 'Mandat Historique' },
    ],
    legend:
      'Chaque bureau travaille bénévolement pour la pérennité de notre patrimoine insulaire.',
  },
  closingTitle:
    "L'AAJ engagée au service de l'architecture et du patrimoine de l'ile",
};

// ---------------- Partners ----------------

export type PartnerIconKey = 'trophy' | 'star' | 'shield';

export interface PartnerCategory {
  name: string;
  iconKey: PartnerIconKey;
  price: string;
  benefits: string[];
}

export interface PagePartnersContent {
  header: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  categoriesTitle: string;
  categories: PartnerCategory[];
  featuredIndex: number;
  trustTitle: string;
  trustPlaceholders: number;
  cta: {
    title: string;
    description: string;
    buttonLabel: string;
  };
}

export const DEFAULT_PAGE_PARTNERS: PagePartnersContent = {
  header: {
    eyebrow: 'Partenariats',
    title: 'Nos Partenaires',
    subtitle: "Ils soutiennent le rayonnement de l'architecture tunisienne.",
  },
  categoriesTitle: 'Catégories de Sponsoring',
  categories: [
    {
      name: 'Platine',
      iconKey: 'trophy',
      price: 'Partenaire Fondateur',
      benefits: ['Logo sur tous supports', 'Stand prioritaire', 'Accès base de données'],
    },
    {
      name: 'Or',
      iconKey: 'star',
      price: 'Mécène Culturel',
      benefits: ['Logo site web', 'Invitation VIP', 'Mention réseaux'],
    },
    {
      name: 'Argent',
      iconKey: 'shield',
      price: 'Support Technique',
      benefits: ['Logo site web', 'Mention événements'],
    },
  ],
  featuredIndex: 1,
  trustTitle: 'Ils nous font confiance',
  trustPlaceholders: 5,
  cta: {
    title: 'Devenir un acteur du changement ?',
    description:
      'Rejoignez-nous pour soutenir des projets innovants et valoriser le patrimoine architectural de Djerba.',
    buttonLabel: 'Devenir Sponsor',
  },
};

// ---------------- shared loader/saver ----------------

export const PAGE_HOME_DOC = { col: 'config', id: 'pageHome' } as const;
export const PAGE_ABOUT_DOC = { col: 'config', id: 'pageAbout' } as const;
export const PAGE_PARTNERS_DOC = { col: 'config', id: 'pagePartners' } as const;

async function loadPageDoc<T>(
  col: string,
  id: string,
  fallback: T,
  pick: (data: any) => Partial<T>
): Promise<T> {
  try {
    const snap = await getDoc(doc(db, col, id));
    if (snap.exists()) {
      const data = snap.data() as any;
      const picked = pick(data);
      return mergeDeep(fallback, picked) as T;
    }
  } catch (err) {
    console.warn(`load ${col}/${id} fallback to defaults:`, err);
  }
  return fallback;
}

async function savePageDoc(col: string, id: string, content: unknown): Promise<void> {
  await setDoc(
    doc(db, col, id),
    { content, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Shallow-deep merge: arrays are replaced wholesale, plain objects merged. */
function mergeDeep<T>(base: T, patch: any): T {
  if (patch == null) return base;
  if (Array.isArray(base) || typeof base !== 'object') return patch ?? base;
  const out: any = { ...base };
  for (const key of Object.keys(patch)) {
    const bv = (base as any)[key];
    const pv = patch[key];
    if (bv && typeof bv === 'object' && !Array.isArray(bv) && pv && typeof pv === 'object' && !Array.isArray(pv)) {
      out[key] = mergeDeep(bv, pv);
    } else if (pv !== undefined) {
      out[key] = pv;
    }
  }
  return out as T;
}

export async function loadPageHome(): Promise<PageHomeContent> {
  return loadPageDoc(PAGE_HOME_DOC.col, PAGE_HOME_DOC.id, DEFAULT_PAGE_HOME, (d) => d?.content ?? d);
}
export async function savePageHome(content: PageHomeContent): Promise<void> {
  await savePageDoc(PAGE_HOME_DOC.col, PAGE_HOME_DOC.id, content);
}

export async function loadPageAbout(): Promise<PageAboutContent> {
  return loadPageDoc(PAGE_ABOUT_DOC.col, PAGE_ABOUT_DOC.id, DEFAULT_PAGE_ABOUT, (d) => d?.content ?? d);
}
export async function savePageAbout(content: PageAboutContent): Promise<void> {
  await savePageDoc(PAGE_ABOUT_DOC.col, PAGE_ABOUT_DOC.id, content);
}

export async function loadPagePartners(): Promise<PagePartnersContent> {
  return loadPageDoc(PAGE_PARTNERS_DOC.col, PAGE_PARTNERS_DOC.id, DEFAULT_PAGE_PARTNERS, (d) => d?.content ?? d);
}
export async function savePagePartners(content: PagePartnersContent): Promise<void> {
  await savePageDoc(PAGE_PARTNERS_DOC.col, PAGE_PARTNERS_DOC.id, content);
}
