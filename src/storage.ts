import type { Snapshot, Tab } from "./tabs";
import { welcomeTab } from "./tabs";

const KEY = "tom-space:v1";

export function loadSnapshot(): Snapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Snapshot;
    if (parsed.v !== 1 || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
      throw new Error("bad");
    }
    const active =
      parsed.tabs.some((t) => t.id === parsed.activeId) ?
        parsed.activeId
      : parsed.tabs[0].id;
    return { v: 1, tabs: parsed.tabs as Tab[], activeId: active };
  } catch {
    const tab = welcomeTab();
    return { v: 1, tabs: [tab], activeId: tab.id };
  }
}

export function saveSnapshot(tabs: Tab[], activeId: string) {
  const body: Snapshot = { v: 1, tabs, activeId };
  localStorage.setItem(KEY, JSON.stringify(body));
}
