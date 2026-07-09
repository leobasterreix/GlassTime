import Link from "next/link";

const FEATURES = [
  {
    icon: "🗓️",
    title: "Agenda unifié",
    text: "Toutes vos diffusions séries, sorties films et livres à lire au même endroit, jour par jour.",
  },
  {
    icon: "📊",
    title: "Statistiques & heatmap",
    text: "Temps de visionnage, genres favoris, séries terminées : suivez votre activité comme sur GitHub.",
  },
  {
    icon: "☁️",
    title: "Sync multi-appareils",
    text: "Commencez sur votre téléphone, continuez sur votre tablette — tout se retrouve à jour partout.",
  },
  {
    icon: "🎲",
    title: "Ce soir, je regarde quoi ?",
    text: "Un picker qui propose un épisode ou un film selon le temps que vous avez devant vous.",
  },
];

const PLANS = [
  {
    name: "Gratuit",
    price: "0€",
    period: "",
    tagline: "Pour découvrir GlassTime",
    items: [
      "Jusqu'à 10 séries ou livres suivis",
      "Agenda et statistiques de base",
      "Un seul appareil",
    ],
    cta: "Commencer gratuitement",
    highlight: false,
  },
  {
    name: "Premium",
    price: "3,99€",
    period: "/mois",
    tagline: "Pour les vrais binge-watchers",
    items: [
      "Séries, films et livres suivis en illimité",
      "Synchronisation sur tous vos appareils",
      "Statistiques avancées et heatmap",
      "Picker « Ce soir, je regarde quoi ? »",
    ],
    cta: "Essayer Premium",
    highlight: true,
  },
];

// Rangées du mockup héro : reproduit visuellement une carte d'agenda (poster
// + lignes de texte + case à cocher), pas une vraie capture d'écran — évite
// d'avoir à maintenir des images à jour à chaque évolution de l'UI.
const MOCKUP_ROWS = [
  { hue: "#6366f1", w1: "72%", w2: "48%", done: true },
  { hue: "#f59e0b", w1: "85%", w2: "40%", done: true },
  { hue: "#22c55e", w1: "60%", w2: "55%", done: false },
  { hue: "#ec4899", w1: "78%", w2: "35%", done: false },
];

export default function MarketingPage() {
  return (
    <>
      <nav className="mk-nav">
        <div className="mk-logo">
          <span className="mk-logo-mark">📺</span>
          GlassTime
        </div>
        <Link href="/login" className="btn btn-primary">
          Se connecter
        </Link>
      </nav>

      <main>
        <section className="mk mk-hero">
          <div>
            <span className="mk-eyebrow">🍿 Séries · Films · Livres</span>
            <h1 className="mk-headline">
              Ne perdez plus jamais <span className="accent">le fil</span> de ce que vous regardez
            </h1>
            <p className="mk-subhead">
              GlassTime rassemble votre agenda de diffusions, vos statistiques
              de visionnage et votre progression — sur tous vos appareils,
              sans jamais rouvrir dix applis différentes.
            </p>
            <div className="mk-cta-row">
              <Link href="/login" className="btn btn-primary">
                Commencer gratuitement
              </Link>
              <a href="#tarifs" className="btn">
                Voir les tarifs
              </a>
            </div>
            <div className="mk-trust">
              <span>✓ Gratuit pour commencer</span>
              <span>·</span>
              <span>✓ Sans engagement</span>
            </div>
          </div>

          <div className="mk-mockup-wrap">
            <div className="mk-mockup-glow" />
            <div className="mk-mockup">
              {MOCKUP_ROWS.map((row, i) => (
                <div className="mk-mockup-row" key={i}>
                  <div
                    className="mk-mockup-poster"
                    style={{ background: `linear-gradient(160deg, ${row.hue}, transparent)` }}
                  />
                  <div className="mk-mockup-lines">
                    <div className="mk-mockup-line" style={{ width: row.w1 }} />
                    <div className="mk-mockup-line" style={{ width: row.w2, marginBottom: 0 }} />
                  </div>
                  <div className={`mk-mockup-check${row.done ? " done" : ""}`} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mk mk-section">
          <div className="mk-section-head">
            <div className="mk-kicker">Fonctionnalités</div>
            <h2 className="mk-section-title">Tout ce qu'il faut pour ne rien manquer</h2>
            <p className="mk-section-sub">
              Pensé pour les séries qui durent des années, pas juste pour la
              première saison.
            </p>
          </div>
          <div className="mk-feature-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass card mk-feature-card">
                <div className="mk-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mk mk-section" id="tarifs">
          <div className="mk-section-head">
            <div className="mk-kicker">Tarifs</div>
            <h2 className="mk-section-title">Un tarif simple, honnête</h2>
            <p className="mk-section-sub">
              Commencez gratuitement, passez Premium quand vous êtes conquis.
              Résiliable à tout moment.
            </p>
          </div>
          <div className="mk-pricing-grid">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`glass card mk-price-card${plan.highlight ? " featured" : ""}`}
              >
                {plan.highlight && <span className="mk-price-badge">Le plus populaire</span>}
                <div className="mk-price-name">{plan.name}</div>
                <div className="mk-price-amount">
                  {plan.price}
                  <span>{plan.period}</span>
                </div>
                <p className="mk-price-tagline">{plan.tagline}</p>
                <ul className="mk-price-list">
                  {plan.items.map((item) => (
                    <li key={item}>
                      <span className="mk-price-check">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`btn${plan.highlight ? " btn-primary" : ""}`}
                  style={{ width: "100%" }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <footer className="mk mk-footer">
          GlassTime — fait avec ❤️ pour les binge-watchers. Résiliable à tout
          moment depuis votre profil.
        </footer>
      </main>
    </>
  );
}
