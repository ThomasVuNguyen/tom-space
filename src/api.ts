import type { AppDef } from "./catalog";
import { iconFor } from "./catalog";

/* ── Coolify API response shapes ── */

type CoolifyApp = {
  uuid: string;
  name: string;
  status: string;
  fqdn: string | null;
};

type CoolifyService = {
  uuid: string;
  name: string;
  status: string;
  fqdn?: string | null;
};

/* ── Helpers ── */

/** Pick the first http(s) domain from a comma-separated fqdn list */
function firstDomain(fqdn: string): string {
  const first = fqdn.split(",")[0].trim();
  try {
    return new URL(first).hostname;
  } catch {
    return first.replace(/^https?:\/\//, "");
  }
}

/** Normalise a raw fqdn into an https URL */
function toUrl(fqdn: string): string {
  const first = fqdn.split(",")[0].trim();
  return first.replace(/^http:\/\//, "https://");
}

/** Slug-ify a name for use as an AppId */
function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ── Fetch & merge ── */

let cache: AppDef[] | null = null;

export async function fetchApps(): Promise<AppDef[]> {
  if (cache) return cache;

  const [appsRes, servicesRes] = await Promise.allSettled([
    fetch("/api/coolify/applications"),
    fetch("/api/coolify/services"),
  ]);

  const apps: CoolifyApp[] =
    appsRes.status === "fulfilled" && appsRes.value.ok
      ? await appsRes.value.json().then((json: CoolifyApp[] | { data?: CoolifyApp[] }) =>
          Array.isArray(json) ? json : (json.data ?? []),
        )
      : [];

  const services: CoolifyService[] =
    servicesRes.status === "fulfilled" && servicesRes.value.ok
      ? await servicesRes.value.json().then((json: CoolifyService[] | { data?: CoolifyService[] }) =>
          Array.isArray(json) ? json : (json.data ?? []),
        )
      : [];

  const result: AppDef[] = [];

  for (const a of apps) {
    if (!a.fqdn) continue;
    const id = toId(a.name);
    result.push({
      id,
      name: a.name,
      host: firstDomain(a.fqdn),
      url: toUrl(a.fqdn),
      icon: iconFor(id, a.name),
      embed: true,
      category: "app",
      status: a.status,
    });
  }

  for (const s of services) {
    if (!s.fqdn) continue;
    const id = toId(s.name);
    result.push({
      id,
      name: s.name,
      host: firstDomain(s.fqdn),
      url: toUrl(s.fqdn),
      icon: iconFor(id, s.name),
      embed: true,
      category: "service",
      status: s.status,
    });
  }

  // Sort: healthy first, then by name
  result.sort((a, b) => {
    const aHealthy = a.status.includes("healthy") ? 0 : 1;
    const bHealthy = b.status.includes("healthy") ? 0 : 1;
    if (aHealthy !== bHealthy) return aHealthy - bHealthy;
    return a.name.localeCompare(b.name);
  });

  cache = result;
  return result;
}

/** Force a fresh fetch on next call */
export function invalidateCache() {
  cache = null;
}
