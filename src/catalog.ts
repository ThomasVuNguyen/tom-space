export type AppId =
  | "starship"
  | "inbox"
  | "content"
  | "dispatcher"
  | "maui"
  | "surf";

export type AppDef = {
  id: AppId;
  name: string;
  host: string;
  url: string;
  icon: string;
  embed: boolean;
};

export const APPS: AppDef[] = [
  {
    id: "starship",
    name: "Starship",
    host: "ship.beenex.org",
    url: "https://ship.beenex.org",
    icon: "/brand/starship.png",
    embed: true,
  },
  {
    id: "inbox",
    name: "Inbox",
    host: "inbox.comfyspace.tech",
    url: "https://inbox.comfyspace.tech",
    icon: "/brand/inbox.png",
    embed: false,
  },
  {
    id: "content",
    name: "Content",
    host: "content.beenex.org",
    url: "https://content.beenex.org",
    icon: "/brand/content.png",
    embed: true,
  },
  {
    id: "dispatcher",
    name: "Dispatcher",
    host: "dispatch.beenex.org",
    url: "https://dispatch.beenex.org",
    icon: "/brand/dispatch.png",
    embed: true,
  },
  {
    id: "maui",
    name: "Maui",
    host: "maui.beenex.org",
    url: "https://maui.beenex.org",
    icon: "/brand/maui.png",
    embed: true,
  },
  {
    id: "surf",
    name: "Surf",
    host: "surf.beenex.org",
    url: "https://surf.beenex.org",
    icon: "/brand/surf.png",
    embed: true,
  },
];

export const APP_BY_ID = Object.fromEntries(APPS.map((app) => [app.id, app])) as Record<
  AppId,
  AppDef
>;
