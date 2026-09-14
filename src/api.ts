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

type CoolifyServer = {
  uuid: string;
  name: string;
};

type CoolifyResource = {
  uuid?: string;
  name?: string;
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

  const [appsRes, servicesRes, serversRes] = await Promise.allSettled([
    fetch("/api/coolify/applications"),
    fetch("/api/coolify/services"),
    fetch("/api/coolify/servers"),
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

  // Map resources to their host server
  const serverByUuid: Record<string, string> = {};
  const serverByName: Record<string, string> = {};

  if (serversRes.status === "fulfilled" && serversRes.value.ok) {
    const servers: CoolifyServer[] = await serversRes.value
      .json()
      .then((json: CoolifyServer[] | { data?: CoolifyServer[] }) =>
        Array.isArray(json) ? json : (json.data ?? []),
      )
      .catch(() => []);

    const resourceResults = await Promise.allSettled(
      servers.map(async (server) => {
        const res = await fetch(`/api/coolify/servers/${server.uuid}/resources`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return { serverName: server.name, resources: [] };
        const json = await res.json();
        const resources: CoolifyResource[] = Array.isArray(json) ? json : (json.data ?? []);
        return { serverName: server.name, resources };
      }),
    );

    for (const r of resourceResults) {
      if (r.status === "fulfilled") {
        for (const item of r.value.resources) {
          if (item.uuid) serverByUuid[item.uuid] = r.value.serverName;
          if (item.name) serverByName[item.name.toLowerCase()] = r.value.serverName;
        }
      }
    }
  }

  const result: AppDef[] = [];

  for (const a of apps) {
    if (!a.fqdn) continue;
    const id = toId(a.name);
    const server = serverByUuid[a.uuid] || serverByName[a.name.toLowerCase()];
    result.push({
      id,
      name: a.name,
      host: firstDomain(a.fqdn),
      url: toUrl(a.fqdn),
      icon: iconFor(id, a.name),
      embed: true,
      category: "app",
      status: a.status,
      ...(server ? { server } : {}),
    });
  }

  for (const s of services) {
    if (!s.fqdn) continue;
    const id = toId(s.name);
    const server = serverByUuid[s.uuid] || serverByName[s.name.toLowerCase()];
    result.push({
      id,
      name: s.name,
      host: firstDomain(s.fqdn),
      url: toUrl(s.fqdn),
      icon: iconFor(id, s.name),
      embed: true,
      category: "service",
      status: s.status,
      ...(server ? { server } : {}),
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
