export type AppId = string;

export type AppDef = {
  id: AppId;
  name: string;
  host: string;
  url: string;
  icon: string;
  embed: boolean;
  category: "app" | "service";
  status: string;
};

/* ── Known brand icons (existing PNGs in /brand/) ── */

const BRAND_ICONS: Record<string, string> = {
  starship: "/brand/starship.png",
  inbox: "/brand/inbox.png",
  comfymail: "/brand/inbox.png",
  content: "/brand/content.png",
  contentmachine: "/brand/content.png",
  dispatcher: "/brand/dispatch.png",
  maui: "/brand/maui.png",
  "ymv2-web": "/brand/maui.png",
  surf: "/brand/surf.png",
  "steel-browser": "/brand/surf.png",
};

/* ── Fallback icon generator ── */

const PALETTE = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function generateIcon(letter: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="32" fill="${color}"/>
    <text x="32" y="32" text-anchor="middle" dominant-baseline="central"
          font-family="system-ui,sans-serif" font-weight="700" font-size="28" fill="#fff">
      ${letter.toUpperCase()}
    </text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Returns the brand icon if known, otherwise a generated fallback */
export function iconFor(id: string, name: string): string {
  if (BRAND_ICONS[id]) return BRAND_ICONS[id];
  const letter = name.charAt(0) || "?";
  return generateIcon(letter, hashColor(name));
}

/** Lookup helper: build a map from an AppDef array */
export function appById(apps: AppDef[]): Record<AppId, AppDef> {
  return Object.fromEntries(apps.map((a) => [a.id, a]));
}
