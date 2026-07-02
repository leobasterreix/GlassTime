/** Jeton de session : SHA-256 du mot de passe (le cookie ne contient jamais le mot de passe). */
export async function authToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`glasstime:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const AUTH_COOKIE = "gt_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 365; // 1 an
