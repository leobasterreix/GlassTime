import Link from "next/link";

const FEATURES = [
  {
    title: "Agenda unifié",
    text: "Toutes vos diffusions séries, sorties films et livres à lire au même endroit, jour par jour.",
  },
  {
    title: "Statistiques & heatmap",
    text: "Temps de visionnage, genres favoris, séries terminées : suivez votre activité comme sur GitHub.",
  },
  {
    title: "Sync multi-appareils",
    text: "Commencez sur votre téléphone, continuez sur votre tablette — tout se retrouve à jour partout.",
  },
  {
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

export default function MarketingPage() {
  return (
    <main className="page" style={{ paddingBottom: 40 }}>
      <div style={{ textAlign: "center", paddingTop: 24 }}>
        <h1 className="page-title">GlassTime</h1>
        <p className="page-sub" style={{ maxWidth: 380, margin: "0 auto 24px" }}>
          Suivez vos séries, films et livres — agenda, statistiques et
          synchronisation, tout au même endroit.
        </p>
        <div className="row" style={{ justifyContent: "center", gap: 10 }}>
          <Link href="/login" className="btn btn-primary">
            Se connecter
          </Link>
          <a href="#tarifs" className="btn">
            Voir les tarifs
          </a>
        </div>
      </div>

      <h2 className="section-title">Ce que vous pouvez faire</h2>
      <div className="stack" style={{ gap: 12 }}>
        {FEATURES.map((f) => (
          <div key={f.title} className="glass card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              {f.text}
            </p>
          </div>
        ))}
      </div>

      <h2 id="tarifs" className="section-title">
        Tarifs
      </h2>
      <div className="stack" style={{ gap: 12 }}>
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`glass card${plan.highlight ? " glass-strong" : ""}`}
            style={{
              padding: 22,
              border: plan.highlight ? "2px solid var(--accent)" : undefined,
            }}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 19, fontWeight: 800 }}>{plan.name}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: plan.highlight ? "var(--accent)" : undefined }}>
                {plan.price}
                <span className="tiny" style={{ fontWeight: 600 }}>{plan.period}</span>
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 14 }}>
              {plan.tagline}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 18px", display: "grid", gap: 8 }}>
              {plan.items.map((item) => (
                <li key={item} className="row" style={{ gap: 8, fontSize: 13.5 }}>
                  <span style={{ color: "var(--accent)" }}>✓</span>
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
      <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 20 }}>
        Sans engagement, résiliable à tout moment depuis votre profil.
      </p>
    </main>
  );
}
