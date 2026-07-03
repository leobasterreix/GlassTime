"use client";

// Couleur d'accent personnalisable.
// À partir d'une couleur choisie, on dérive les 4 variables CSS que le design
// utilise (--accent, --accent-fg, --accent-wash, --accent-ink), en tenant
// compte du thème clair/sombre pour rester lisible.

export type AccentPreset = {
  name: string;
  /** Pastille affichée dans le sélecteur. */
  swatch: string;
  /** Valeur stockée : null = corail par défaut du thème. */
  value: string | null;
};

/** 4 teintes proposées ; la 1re (null) restaure le corail par défaut. */
export const ACCENT_PRESETS: AccentPreset[] = [
  { name: "Corail", swatch: "#d9503a", value: null },
  { name: "Indigo", swatch: "#5566d6", value: "#5566d6" },
  { name: "Vert", swatch: "#2f9e6f", value: "#2f9e6f" },
  { name: "Ambre", swatch: "#cf8a2e", value: "#cf8a2e" },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Mélange linéaire vers une cible (0 = couleur d'origine, 1 = cible). */
function mix(
  c: { r: number; g: number; b: number },
  target: number,
  t: number
): string {
  const r = Math.round(c.r + (target - c.r) * t);
  const g = Math.round(c.g + (target - c.g) * t);
  const b = Math.round(c.b + (target - c.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Applique (ou retire) l'accent personnalisé sur la racine du document.
 * `color` null → on retire les surcharges, le corail par défaut du CSS reprend.
 */
export function applyAccent(
  color: string | null,
  resolved: "light" | "dark"
): void {
  const root = document.documentElement.style;
  const props = ["--accent", "--accent-fg", "--accent-wash", "--accent-ink"];

  if (!color) {
    props.forEach((p) => root.removeProperty(p));
    return;
  }
  const rgb = hexToRgb(color);
  if (!rgb) {
    props.forEach((p) => root.removeProperty(p));
    return;
  }

  // Luminance perçue → texte foncé sur accent clair (ex. ambre), blanc sinon.
  const lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  const fg = lum > 150 ? "#241f18" : "#ffffff";
  const wash = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`;
  // Version « encre » pour le texte : plus foncée sur papier, plus claire sur nuit.
  const ink = resolved === "light" ? mix(rgb, 0, 0.28) : mix(rgb, 255, 0.28);

  root.setProperty("--accent", color);
  root.setProperty("--accent-fg", fg);
  root.setProperty("--accent-wash", wash);
  root.setProperty("--accent-ink", ink);
}
