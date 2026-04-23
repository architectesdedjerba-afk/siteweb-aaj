/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const LegalNoticePage = () => {
  return (
    <div className="pt-16 min-h-screen bg-white">
      <header className="border-b border-aaj-border py-16 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <span className="text-[10px] uppercase tracking-[3px] text-aaj-royal font-black mb-4 block">
            Informations Légales
          </span>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
            Mentions Légales
          </h1>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-16 space-y-12 text-aaj-dark">
        <article>
          <h2 className="text-lg font-black uppercase tracking-widest mb-4 text-aaj-royal">
            Éditeur du site
          </h2>
          <p className="text-sm leading-relaxed text-aaj-gray">
            Association des Architectes de Jerba (AAJ) — Association à but non lucratif.
            <br />
            Adresse : Houmt Souk, Djerba, Tunisie.
            <br />
            Email :{' '}
            <a
              href="mailto:architectes.de.djerba@gmail.com"
              className="text-aaj-royal hover:underline"
            >
              architectes.de.djerba@gmail.com
            </a>
          </p>
        </article>

        <article>
          <h2 className="text-lg font-black uppercase tracking-widest mb-4 text-aaj-royal">
            Hébergement
          </h2>
          <p className="text-sm leading-relaxed text-aaj-gray">
            Le site est hébergé chez un prestataire cPanel mutualisé (hébergement web standard PHP /
            MySQL). Les données sont stockées en Europe / Afrique du Nord selon le datacenter du
            prestataire.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-black uppercase tracking-widest mb-4 text-aaj-royal">
            Propriété intellectuelle
          </h2>
          <p className="text-sm leading-relaxed text-aaj-gray">
            L'ensemble des contenus publiés sur ce site (textes, images, logos, structure) est la
            propriété exclusive de l'AAJ, sauf mention contraire. Toute reproduction, diffusion ou
            utilisation, même partielle, est soumise à autorisation préalable écrite.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-black uppercase tracking-widest mb-4 text-aaj-royal">
            Protection des données personnelles
          </h2>
          <p className="text-sm leading-relaxed text-aaj-gray mb-4">
            Conformément à la loi tunisienne n°2004-63 relative à la protection des données à
            caractère personnel et au RGPD (Règlement UE 2016/679) pour les visiteurs concernés,
            vous disposez d'un droit d'accès, de rectification, d'opposition et de suppression de
            vos données.
          </p>
          <p className="text-sm leading-relaxed text-aaj-gray mb-4">
            Les données collectées via les formulaires (inscription événement, demande d'adhésion,
            demande de partenariat, messagerie) sont utilisées uniquement pour le traitement de
            votre demande et ne sont pas cédées à des tiers.
          </p>
          <p className="text-sm leading-relaxed text-aaj-gray">
            Pour exercer vos droits :{' '}
            <a
              href="mailto:architectes.de.djerba@gmail.com"
              className="text-aaj-royal hover:underline"
            >
              architectes.de.djerba@gmail.com
            </a>
          </p>
        </article>

        <article>
          <h2 className="text-lg font-black uppercase tracking-widest mb-4 text-aaj-royal">
            Cookies
          </h2>
          <p className="text-sm leading-relaxed text-aaj-gray">
            Ce site utilise uniquement des cookies techniques nécessaires à l'authentification
            (session httpOnly côté serveur). Aucun cookie publicitaire ou de suivi tiers n'est
            déposé. Votre consentement est recueilli lors de votre première visite.
          </p>
        </article>

        <article>
          <h2 className="text-lg font-black uppercase tracking-widest mb-4 text-aaj-royal">
            Responsabilité
          </h2>
          <p className="text-sm leading-relaxed text-aaj-gray">
            L'AAJ s'efforce de garantir l'exactitude des informations diffusées mais ne saurait être
            tenue responsable des erreurs, omissions ou indisponibilités techniques.
          </p>
        </article>
      </section>
    </div>
  );
};
