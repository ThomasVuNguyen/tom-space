import type { AppId } from "./catalog";

export type Pane = {
  paneId: string;
  appId: AppId;
};

export type Tab =
  | { id: string; kind: "welcome" }
  | { id: string; kind: "app"; pane: Pane }
  | { id: string; kind: "split"; left: Pane; right: Pane };

export type Snapshot = {
  v: 1;
  tabs: Tab[];
  activeId: string;
};

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function tabTitle(tab: Tab, nameOf: (id: AppId) => string) {
  if (tab.kind === "welcome") return "Welcome";
  if (tab.kind === "app") return nameOf(tab.pane.appId);
  return `${nameOf(tab.left.appId)} | ${nameOf(tab.right.appId)}`;
}

export function panesIn(tab: Tab): Pane[] {
  if (tab.kind === "welcome") return [];
  if (tab.kind === "app") return [tab.pane];
  return [tab.left, tab.right];
}

export function allPanes(tabs: Tab[]) {
  return tabs.flatMap(panesIn);
}

export function welcomeTab(): Tab {
  return { id: uid("tab"), kind: "welcome" };
}

export function openAppInTab(tab: Tab, appId: AppId): Tab {
  if (tab.kind === "welcome") {
    return { id: tab.id, kind: "app", pane: { paneId: uid("pane"), appId } };
  }
  return tab;
}

export function insertWelcomeAfter(tabs: Tab[], activeId: string) {
  const next = welcomeTab();
  const i = tabs.findIndex((t) => t.id === activeId);
  const tabsNext = [...tabs];
  tabsNext.splice(i + 1, 0, next);
  return { tabs: tabsNext, activeId: next.id };
}

export function closeTab(tabs: Tab[], activeId: string, id: string) {
  const remaining = tabs.filter((t) => t.id !== id);
  if (remaining.length === 0) {
    const fresh = welcomeTab();
    return { tabs: [fresh], activeId: fresh.id };
  }
  if (activeId !== id) return { tabs: remaining, activeId };
  const i = tabs.findIndex((t) => t.id === id);
  const neighbor = remaining[Math.min(i, remaining.length - 1)];
  return { tabs: remaining, activeId: neighbor.id };
}

export function splitWith(
  tabs: Tab[],
  activeId: string,
  draggedId: string,
  side: "left" | "right",
) {
  if (draggedId === activeId) return { tabs, activeId };
  const active = tabs.find((t) => t.id === activeId);
  const dragged = tabs.find((t) => t.id === draggedId);
  if (!active || !dragged) return { tabs, activeId };
  if (active.kind === "welcome" || dragged.kind === "welcome") {
    return { tabs, activeId };
  }
  if (dragged.kind === "split") return { tabs, activeId };

  const incoming = dragged.pane;

  let nextActive: Tab;
  if (active.kind === "app") {
    nextActive =
      side === "left"
        ? { id: active.id, kind: "split", left: incoming, right: active.pane }
        : { id: active.id, kind: "split", left: active.pane, right: incoming };
  } else if (side === "left") {
    nextActive = { ...active, left: incoming };
  } else {
    nextActive = { ...active, right: incoming };
  }

  const withoutDragged = tabs.filter((t) => t.id !== draggedId);
  return {
    tabs: withoutDragged.map((t) => (t.id === active.id ? nextActive : t)),
    activeId: active.id,
  };
}

export function separateTabs(tabs: Tab[], activeId: string, id: string) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab || tab.kind !== "split") return { tabs, activeId };
  const left: Tab = { id: uid("tab"), kind: "app", pane: tab.left };
  const right: Tab = { id: uid("tab"), kind: "app", pane: tab.right };
  const i = tabs.findIndex((t) => t.id === id);
  const next = [...tabs];
  next.splice(i, 1, left, right);
  return { tabs: next, activeId: left.id };
}

export function moveTab(tabs: Tab[], fromId: string, beforeId: string | null) {
  const from = tabs.find((t) => t.id === fromId);
  if (!from) return tabs;
  const rest = tabs.filter((t) => t.id !== fromId);
  if (!beforeId) return [...rest, from];
  const i = rest.findIndex((t) => t.id === beforeId);
  if (i < 0) return tabs;
  const next = [...rest];
  next.splice(i, 0, from);
  return next;
}
