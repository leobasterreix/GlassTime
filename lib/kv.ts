// Accès Redis via l'API REST d'Upstash (base "KV" du marketplace Vercel).
// Aucune dépendance : de simples fetch avec le jeton en Bearer.
// Variables reconnues : KV_REST_API_URL/KV_REST_API_TOKEN (intégration Vercel)
// ou UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN (Upstash direct).

function kvEnv() {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function kvConfigured(): boolean {
  return !!kvEnv();
}

export async function kvGet(key: string): Promise<string | null> {
  const env = kvEnv();
  if (!env) return null;
  const res = await fetch(`${env.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${env.token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV GET ${res.status}`);
  const data = await res.json();
  return data.result ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  const env = kvEnv();
  if (!env) return;
  const res = await fetch(`${env.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.token}` },
    body: value,
  });
  if (!res.ok) throw new Error(`KV SET ${res.status}`);
}
