import { useCallback, useEffect, useRef, useState } from "react";
import {
  BotMessageSquare,
  Check,
  FoldVertical,
  Moon,
  RotateCcw,
  Save,
  Sun,
  UnfoldVertical,
} from "lucide-react";

import { useTheme } from "@/lib/theme";
import { useDensity } from "@/lib/density";
import { OverviewTab } from "./OverviewTab";
import { PulseTab } from "./PulseTab";
import { IdeasTab } from "./IdeasTab";
import { PaperTab } from "./PaperTab";
import { VirtualPortfolioTab } from "./VirtualPortfolioTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { useLayoutPersistence } from "./useLayoutPersistence";

type TabId =
  "overview" | "reader" | "ideas" | "paper" | "virtual" | "analytics";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Genel bakış" },
  { id: "reader", label: "Piyasa Nabzı" },
  { id: "ideas", label: "Pozisyon Fikirleri" },
  { id: "paper", label: "Paper Trading" },
  { id: "virtual", label: "Sanal Portföy" },
  { id: "analytics", label: "Analiz" },
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
  const [tab, setTab] = useState<TabId>(readTab);
  // Set when the overview brief deep-links into a bulletin section; the reader
  // consumes it on arrival and clears it so a later manual visit starts at the top.
  const [pendingJump, setPendingJump] = useState<string | null>(null);

  const { theme, toggle } = useTheme();
  const { density, toggle: toggleDensity } = useDensity();
  const { save, reset, saved } = useLayoutPersistence();
  const isDark = theme === "dark";
  const isCompact = density === "compact";

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
  }, []);

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
                <div className="flex items-center gap-2.5">
                  <span className="text-mid num hidden text-xs sm:inline">
                    {todayFmt.format(new Date())}
                  </span>

                  {/* Layout group — segmented, mirroring the old dashboard's controls. */}
                  <div className="flex items-center">
                    <IconToggle
                      onClick={reset}
                      title="Düzeni sıfırla"
                      className="rounded-r-none border-r-0"
                    >
                      <RotateCcw className="size-[15px]" />
                    </IconToggle>
                    <IconToggle
                      onClick={save}
                      title="Düzeni kaydet"
                      className="rounded-l-none"
                    >
                      {saved ? (
                        <Check className="size-[15px] text-[var(--up)]" />
                      ) : (
                        <Save className="size-[15px]" />
                      )}
                    </IconToggle>
                  </div>

                  {/* The icon shows the action, not the state — same as the theme toggle. */}
                  <IconToggle
                    onClick={toggleDensity}
                    title={
                      isCompact
                        ? "Satır aralığını genişlet"
                        : "Satır aralığını sıklaştır"
                    }
                  >
                    {isCompact ? (
                      <UnfoldVertical className="size-[15px]" />
                    ) : (
                      <FoldVertical className="size-[15px]" />
                    )}
                  </IconToggle>
                  <IconToggle
                    onClick={toggle}
                    title={isDark ? "Açık tema" : "Koyu tema"}
                  >
                    {isDark ? (
                      <Sun className="size-[15px]" />
                    ) : (
                      <Moon className="size-[15px]" />
                    )}
                  </IconToggle>
                </div>
              </div>
            </div>
          </div>

          <nav className="eqr-header-nav flex items-center gap-6 overflow-x-auto">
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
                {t.label}
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

function IconToggle({
  onClick,
  title,
  children,
  className = "",
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`border-faint bg-card text-mid hover:bg-faint2 hover:text-ink inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
