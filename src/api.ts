import type { AppDef, ServerResource, ServerStats } from "./catalog";
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
  ip: string;
  is_reachable?: boolean;
};

type CoolifyResource = {
  uuid?: string;
  name?: string;
  type?: string;
  status?: string;
};

export type CatalogData = {
  apps: AppDef[];
  servers: ServerStats[];
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

let cache: CatalogData | null = null;

export async function fetchCatalog(): Promise<CatalogData> {
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

  // Map resources to their host server & compute server stats
  const serverByUuid: Record<string, string> = {};
  const serverByName: Record<string, string> = {};
  const computedServers: ServerStats[] = [];

  if (serversRes.status === "fulfilled" && serversRes.value.ok) {
    const rawServers: CoolifyServer[] = await serversRes.value
      .json()
      .then((json: CoolifyServer[] | { data?: CoolifyServer[] }) =>
        Array.isArray(json) ? json : (json.data ?? []),
      )
      .catch(() => []);

    const resourceResults = await Promise.allSettled(
      rawServers.map(async (server) => {
        const res = await fetch(`/api/coolify/servers/${server.uuid}/resources`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return { server, resources: [] as CoolifyResource[] };
        const json = await res.json();
        const resources: CoolifyResource[] = Array.isArray(json) ? json : (json.data ?? []);
        return { server, resources };
      }),
    );

    for (const r of resourceResults) {
      if (r.status === "fulfilled") {
        const { server, resources } = r.value;
        const validResources: ServerResource[] = [];

        let appsCount = 0;
        let dbCount = 0;
        let servicesCount = 0;
        let healthyCount = 0;
        let unhealthyCount = 0;
        let exitedCount = 0;

        for (const item of resources) {
          const uuid = item.uuid || "";
          const name = item.name || "";
          const type = item.type || "application";
          const status = item.status || "unknown";

          if (uuid) serverByUuid[uuid] = server.name;
          if (name) serverByName[name.toLowerCase()] = server.name;

          validResources.push({ uuid, name, type, status });

          // Counts by type
          if (type === "application") {
            appsCount++;
          } else if (
            type.includes("postgresql") ||
            type.includes("redis") ||
            type.includes("database") ||
            type.includes("mysql") ||
            type.includes("mongodb")
          ) {
            dbCount++;
          } else if (type === "service") {
            servicesCount++;
          }

          // Counts by status
          if (status.includes("healthy")) {
            healthyCount++;
          } else if (status.includes("unhealthy") || status.includes("degraded")) {
            unhealthyCount++;
          } else if (status.includes("exited") || status.includes("stopped")) {
            exitedCount++;
          }
        }

        computedServers.push({
          uuid: server.uuid,
          name: server.name,
          ip: server.ip,
          isReachable: server.is_reachable ?? true,
          totalResources: validResources.length,
          appsCount,
          dbCount,
          servicesCount,
          healthyCount,
          unhealthyCount,
          exitedCount,
          resources: validResources,
        });
      }
    }
  }

  // Sort servers: reachable first, then by total resources descending, then by name
  computedServers.sort((a, b) => {
    if (a.isReachable !== b.isReachable) return a.isReachable ? -1 : 1;
    if (b.totalResources !== a.totalResources) return b.totalResources - a.totalResources;
    return a.name.localeCompare(b.name);
  });

  const appResults: AppDef[] = [];

  for (const a of apps) {
    if (!a.fqdn) continue;
    const id = toId(a.name);
    const server = serverByUuid[a.uuid] || serverByName[a.name.toLowerCase()];
    appResults.push({
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
    appResults.push({
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

  // Sort apps: healthy first, then by name
  appResults.sort((a, b) => {
    const aHealthy = a.status.includes("healthy") ? 0 : 1;
    const bHealthy = b.status.includes("healthy") ? 0 : 1;
    if (aHealthy !== bHealthy) return aHealthy - bHealthy;
    return a.name.localeCompare(b.name);
  });

  cache = { apps: appResults, servers: computedServers };
  return cache;
}

export async function fetchApps(): Promise<AppDef[]> {
  const catalog = await fetchCatalog();
  return catalog.apps;
}

/** Force a fresh fetch on next call */
export function invalidateCache() {
  cache = null;
}
