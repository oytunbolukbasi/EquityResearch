import { useCallback, useEffect, useRef, useState } from "react";
import { BotMessageSquare } from "lucide-react";

import { OverviewTab } from "./OverviewTab";
import { PulseTab } from "./PulseTab";
import { IdeasTab } from "./IdeasTab";
import { PaperTab } from "./PaperTab";
import { VirtualPortfolioTab } from "./VirtualPortfolioTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { useLayoutPersistence } from "./useLayoutPersistence";
import { ProfileMenu } from "./ProfileMenu";
import { LoginScreen } from "./LoginScreen";
import { useSession } from "@/lib/session";

type TabId =
  "overview" | "reader" | "ideas" | "paper" | "virtual" | "analytics";

/**
 * `short` is what a phone shows: six full labels need 580px of strip, so on a
 * 375px screen four of the six sat off-screen behind a scroll nobody can see.
 */
const TABS: { id: TabId; label: string; short: string }[] = [
  { id: "overview", label: "Genel bakış", short: "Genel" },
  { id: "reader", label: "Piyasa Nabzı", short: "Nabız" },
  { id: "ideas", label: "Pozisyon Fikirleri", short: "Fikirler" },
  { id: "paper", label: "Paper Trading", short: "Paper" },
  { id: "virtual", label: "Sanal Portföy", short: "Portföy" },
  { id: "analytics", label: "Analiz", short: "Analiz" },
];

const TAB_KEY = "eqr2:tab";

/** Reopen on the tab last used, falling back to the overview. */
function readTab(): TabId {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (TABS.some((t) => t.id === saved)) return saved as TabId;
  } catch {
    /* private mode — start on the overview */
  }
  return "overview";
}

const todayFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function Workspace() {
  const { authenticated, loading: sessionLoading } = useSession();
  const [tab, setTab] = useState<TabId>(readTab);
  // Set when the overview brief deep-links into a bulletin section; the reader
  // consumes it on arrival and clears it so a later manual visit starts at the top.
  const [pendingJump, setPendingJump] = useState<string | null>(null);

  const { save, reset, saved } = useLayoutPersistence();

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* private mode — the choice still applies for this session */
    }
  }, [tab]);

  const openPulse = useCallback((sectionId?: string) => {
    setPendingJump(sectionId ?? null);
    setTab("reader");
  }, []);

  const clearJump = useCallback(() => setPendingJump(null), []);

  // Collapse the header's identity row once the page is scrolled.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // `authenticated` is in the deps on purpose. The login gate below returns
  // early while the session is still loading, so on the first pass the sentinel
  // is not in the DOM yet — with an empty dep list this ran once against a null
  // ref, bailed, and never attached. The header then stayed open on scroll.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      {
        threshold: 0,
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [authenticated]);

  // One door for the whole panel. Hooks above run either way — a conditional
  // return must not sit above them.
  if (sessionLoading) return null;
  if (!authenticated) return <LoginScreen />;

  return (
    <div className="min-h-screen">
      {/*
        Watched by the observer above: once this scrolls out of view the header
        is stuck to the top, which is exactly when it should collapse. Cheaper
        and steadier than reading scrollY on every frame.
      */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      <header
        className="bg-card border-faint sticky top-0 z-30 border-b"
        data-collapsed={collapsed || undefined}
      >
        <div className="mx-auto max-w-[1280px] px-6">
          {/* Identity row folds away on scroll, leaving just the tab names. */}
          <div className="eqr-header-top grid">
            <div className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 pt-4">
                <div className="flex items-center gap-2.5 text-[21px] font-medium tracking-[-0.8px]">
                  {/* One full turn on load. Plain CSS: a whole animation library for
                  a single 0.9s rotate cost ~120 kB of bundle. */}
                  <span className="eqr-logo-spin inline-flex">
                    <BotMessageSquare
                      className="size-[22px] text-[var(--up)]"
                      strokeWidth={1.75}
                    />
                  </span>
                  EQR
                </div>
                {/* Date and account, nothing else. The four icon buttons that
                    used to sit here (reset, save, density, theme) are settings
                    for the whole panel, which is what the account menu already
                    was — so they live there now. (GÖREV 46) */}
                <div className="flex items-center gap-2.5">
                  <span className="text-mid num hidden text-xs sm:inline">
                    {todayFmt.format(new Date())}
                  </span>
                  <ProfileMenu
                    onResetLayout={reset}
                    onSaveLayout={save}
                    layoutSaved={saved}
                  />
                </div>
              </div>
            </div>
          </div>

          <nav className="eqr-header-nav flex items-center gap-3.5 overflow-x-auto pr-6 sm:gap-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className="shrink-0 cursor-pointer border-0 border-b-2 bg-transparent px-0 pt-0 pb-[13px] text-[13px] transition-colors"
                style={{
                  borderBottomColor:
                    tab === t.id ? "var(--info)" : "transparent",
                  color: tab === t.id ? "var(--info)" : "var(--mid)",
                  fontWeight: tab === t.id ? 500 : 400,
                }}
              >
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-6 pt-6 pb-10">
        {tab === "overview" && <OverviewTab onOpenPulse={openPulse} />}
        {tab === "reader" && (
          <PulseTab
            jumpTo={pendingJump}
            onJumpHandled={clearJump}
            onBack={() => setTab("overview")}
          />
        )}
        {tab === "ideas" && <IdeasTab />}
        {tab === "paper" && <PaperTab />}
        {tab === "virtual" && <VirtualPortfolioTab />}
        {tab === "analytics" && <AnalyticsTab />}
      </main>

      <footer className="border-faint border-t">
        <div className="mx-auto max-w-[1280px] px-6 py-3">
          <p className="num text-mid text-[12px]">
            Charts powered by{" "}
            <a
              href="https://tradingview.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              TradingView
            </a>{" "}
            Lightweight Charts (Apache 2.0)
          </p>
        </div>
      </footer>
    </div>
  );
}
