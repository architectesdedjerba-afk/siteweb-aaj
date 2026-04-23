/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Helmet } from 'react-helmet-async';

interface SEOProps {
  /** Titre de la page (sera préfixé par "AAJ — ...") */
  title: string;
  /** Description (doit rester sous 160 caractères idéalement) */
  description: string;
  /** URL canonique relative (ex: "/aaj") — sera jointe à l'origin */
  path?: string;
  /** URL absolue ou chemin de l'image OpenGraph */
  image?: string;
  /** type OG (défaut "website") */
  type?: 'website' | 'article' | 'profile';
  /** noindex si true */
  noindex?: boolean;
}

const SITE_NAME = 'AAJ — Association des Architectes de Jerba';
const DEFAULT_IMAGE = '/assets/logo-C2pZDYH7.png';
const SITE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://aaj-web.com';

export const SEO = ({
  title,
  description,
  path = '',
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
}: SEOProps) => {
  const fullTitle = title.includes('AAJ') ? title : `${title} — AAJ`;
  const canonical = `${SITE_URL}${path}`;
  const imageUrl = image.startsWith('http') ? image : `${SITE_URL}${image}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:locale" content="fr_FR" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
};
