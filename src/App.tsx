import { useEffect, useMemo, useRef, useState } from "react";
import { APP_BY_ID, APPS, type AppId } from "./catalog";
import { loadSnapshot, saveSnapshot } from "./storage";
import {
  closeTab,
  insertWelcomeAfter,
  openAppInTab,
  separateTabs,
  splitWith,
  tabTitle,
  allPanes,
  type Tab,
} from "./tabs";

type Menu = { x: number; y: number; tabId: string } | null;
type Drag = {
  tabId: string;
  x: number;
  y: number;
  side: "left" | "right" | null;
} | null;

function greeting() {
  const d = new Date();
  const day = d.toLocaleDateString("en-US", { weekday: "long" });
  const h = d.getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `${day} ${part}`;
}

function slotFor(tab: Tab | undefined, paneId: string): "full" | "left" | "right" | "hidden" {
  if (!tab || tab.kind === "welcome") return "hidden";
  if (tab.kind === "app") return tab.pane.paneId === paneId ? "full" : "hidden";
  if (tab.left.paneId === paneId) return "left";
  if (tab.right.paneId === paneId) return "right";
  return "hidden";
}

export function App() {
  const boot = useMemo(loadSnapshot, []);
  const [tabs, setTabs] = useState<Tab[]>(boot.tabs);
  const [activeId, setActiveId] = useState(boot.activeId);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(0);
  const [menu, setMenu] = useState<Menu>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef(tabs);
  const activeRef = useRef(activeId);
  const dragSideRef = useRef<"left" | "right" | null>(null);
  tabsRef.current = tabs;
  activeRef.current = activeId;

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const filtered = APPS.filter((app) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return app.name.toLowerCase().includes(q) || app.host.toLowerCase().includes(q);
  });

  useEffect(() => {
    saveSnapshot(tabs, activeId);
  }, [tabs, activeId]);

  useEffect(() => {
    setPicked(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const currentTabs = tabsRef.current;
      const currentActiveId = activeRef.current;
      const current = currentTabs.find((t) => t.id === currentActiveId);
      if (meta && e.key.toLowerCase() === "w") {
        e.preventDefault();
        removeTab(currentActiveId);
        return;
      }
      if (meta && e.key.toLowerCase() === "t") {
        e.preventDefault();
        addWelcome();
        return;
      }
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (current?.kind === "welcome") searchRef.current?.focus();
        return;
      }
      if (current?.kind !== "welcome") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPicked((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPicked((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && filtered[picked]) openApp(filtered[picked].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  function addWelcome() {
    const next = insertWelcomeAfter(tabs, activeId);
    setTabs(next.tabs);
    setActiveId(next.activeId);
    setQuery("");
  }

  function removeTab(id: string) {
    const next = closeTab(tabs, activeId, id);
    setTabs(next.tabs);
    setActiveId(next.activeId);
    setMenu(null);
    setQuery("");
  }

  function openApp(appId: AppId) {
    if (!active || active.kind !== "welcome") {
      const next = insertWelcomeAfter(tabs, activeId);
      const converted = next.tabs.map((t) =>
        t.id === next.activeId ? openAppInTab(t, appId) : t,
      );
      setTabs(converted);
      setActiveId(next.activeId);
      return;
    }
    setTabs(tabs.map((t) => (t.id === active.id ? openAppInTab(t, appId) : t)));
  }

  function onSeparate(id: string) {
    const next = separateTabs(tabs, activeId, id);
    setTabs(next.tabs);
    setActiveId(next.activeId);
    setMenu(null);
  }

  function openOutside(tab: Tab) {
    if (tab.kind === "app") window.open(APP_BY_ID[tab.pane.appId].url, "_blank", "noopener");
    if (tab.kind === "split") {
      window.open(APP_BY_ID[tab.left.appId].url, "_blank", "noopener");
      window.open(APP_BY_ID[tab.right.appId].url, "_blank", "noopener");
    }
    setMenu(null);
  }

  function dropSide(x: number, y: number, draggedId: string): "left" | "right" | null {
    const well = wellRef.current;
    if (!well || activeRef.current === draggedId) return null;
    const r = well.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    return x < r.left + r.width / 2 ? "left" : "right";
  }

  function onTabDragStart(e: React.DragEvent, tab: Tab) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/tab-id", tab.id);
    const blank = document.createElement("canvas");
    blank.width = 1;
    blank.height = 1;
    e.dataTransfer.setDragImage(blank, 0, 0);
    setDrag({ tabId: tab.id, x: e.clientX, y: e.clientY, side: null });
  }

  function onTabDrag(e: React.DragEvent, tab: Tab) {
    if (e.clientX === 0 && e.clientY === 0) return;
    const side = dropSide(e.clientX, e.clientY, tab.id);
    dragSideRef.current = side;
    setDrag({
      tabId: tab.id,
      x: e.clientX,
      y: e.clientY,
      side,
    });
  }

  function onTabDragEnd(e: React.DragEvent, tab: Tab) {
    const side = dragSideRef.current ?? dropSide(e.clientX, e.clientY, tab.id);
    dragSideRef.current = null;
    setDrag(null);
    if (!side) return;
    const next = splitWith(tabsRef.current, activeRef.current, tab.id, side);
    setTabs(next.tabs);
    setActiveId(next.activeId);
  }

  function onStageDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  const dragTab = drag ? tabs.find((t) => t.id === drag.tabId) : null;
  const canSplit =
    drag &&
    drag.side &&
    active &&
    active.kind !== "welcome" &&
    drag.tabId !== active.id &&
    dragTab?.kind === "app";

  const panes = allPanes(tabs);

  return (
    <div className="shell">
      <div className="room">
        <header className="tabbar">
          <div className="tabs" role="tablist">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                role="tab"
                aria-selected={tab.id === activeId}
                draggable
                className={`tab${tab.id === activeId ? " active" : ""}`}
                onClick={() => setActiveId(tab.id)}
                onDragStart={(e) => onTabDragStart(e, tab)}
                onDrag={(e) => onTabDrag(e, tab)}
                onDragEnd={(e) => onTabDragEnd(e, tab)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setActiveId(tab.id);
                  setMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                }}
              >
                {tab.kind === "app" && (
                  <img src={APP_BY_ID[tab.pane.appId].icon} alt="" />
                )}
                {tab.kind === "split" && (
                  <>
                    <img src={APP_BY_ID[tab.left.appId].icon} alt="" />
                    <img src={APP_BY_ID[tab.right.appId].icon} alt="" />
                  </>
                )}
                <span>{tabTitle(tab, (id) => APP_BY_ID[id].name)}</span>
                <button
                  className="x"
                  aria-label={`Close ${tabTitle(tab, (id) => APP_BY_ID[id].name)}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTab(tab.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <button className="plus" onClick={addWelcome} aria-label="New tab">
              +
            </button>
          </div>
          <img className="mark" src="/brand/comfyspace.png" alt="ComfySpace" />
        </header>

        <div
          className="stage"
          ref={wellRef}
          onDragOver={onStageDragOver}
          onDrop={(e) => e.preventDefault()}
        >
          {active?.kind === "welcome" && (
            <div className="welcome">
              <div className="prompt">
                <div className="greet">{greeting()}</div>
                <h1>What we doing, boss?</h1>
                <label className="search">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <input
                    ref={searchRef}
                    value={query}
                    placeholder="Jump to an app"
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                  />
                  <span className="hint">cmd</span>
                </label>
                <div className="list">
                  {filtered.length === 0 && (
                    <div className="empty">Nothing named like that.</div>
                  )}
                  {filtered.map((app, i) => (
                    <button
                      key={app.id}
                      className={`row${i === picked ? " active" : ""}`}
                      onMouseEnter={() => setPicked(i)}
                      onClick={() => openApp(app.id)}
                    >
                      <img src={app.icon} alt="" />
                      <span className="copy">
                        <strong>{app.name}</strong>
                        <span>{app.host}</span>
                      </span>
                      {i === picked && <span className="enter">↵</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {active?.kind === "split" && (
            <span className="handle" aria-hidden>
              <i />
            </span>
          )}

          {panes.map((pane) => {
            const app = APP_BY_ID[pane.appId];
            const slot = slotFor(active, pane.paneId);
            if (!app.embed) {
              return (
                <div key={pane.paneId} className={`live ${slot}`}>
                  <div className="blocked">
                    <p>{app.host}</p>
                    <h2>{app.name}</h2>
                    <p>This one won’t sit in a pane.</p>
                    <button onClick={() => window.open(app.url, "_blank", "noopener")}>
                      Open outside
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <iframe
                key={pane.paneId}
                className={`live ${slot}`}
                title={app.name}
                src={app.url}
                allow="clipboard-read; clipboard-write; fullscreen"
              />
            );
          })}

          {canSplit && drag?.side && (
            <div className="ghost">
              <div className={`half${drag.side === "left" ? " on" : ""}`} />
              <div className={`half${drag.side === "right" ? " on" : ""}`} />
            </div>
          )}
        </div>
      </div>

      {drag && dragTab && (
        <div className="drag-ghost" style={{ left: drag.x + 12, top: drag.y + 12 }}>
          {dragTab.kind === "app" && <img src={APP_BY_ID[dragTab.pane.appId].icon} alt="" />}
          <span>{tabTitle(dragTab, (id) => APP_BY_ID[id].name)}</span>
        </div>
      )}

      {menu && (
        <div className="menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          {tabs.find((t) => t.id === menu.tabId)?.kind === "split" && (
            <button onClick={() => onSeparate(menu.tabId)}>Separate tabs</button>
          )}
          {tabs.find((t) => t.id === menu.tabId)?.kind !== "welcome" && (
            <button
              onClick={() => {
                const tab = tabs.find((t) => t.id === menu.tabId);
                if (tab) openOutside(tab);
              }}
            >
              Open outside
            </button>
          )}
          <button onClick={() => removeTab(menu.tabId)}>Close tab</button>
        </div>
      )}
    </div>
  );
}
