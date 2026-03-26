import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Check,
  BadgeCheck,
  Star,
  X,
  Loader2,
  ExternalLink,
  RefreshCw,
  Gift,
  AlertCircle,
  LogOut,
} from "lucide-react";

type RobloxUser = {
  id: number;
  name: string;
  displayName?: string;
  hasVerifiedBadge?: boolean;
};

type RobloxThumbnail = {
  targetId: number;
  imageUrl?: string;
};

const ROBLOX_PROXY_BASE = "/api";
// Bila deploy, isi contoh:
// const ROBLOX_PROXY_BASE = "/api/roblox";
// lalu endpoint jadi /api/roblox/users/search?keyword=...

const STARTING_ROBUX = 952233;
const ROBUX_RATE_PER_1000_USD = 9.99;
const ROBUX_RATE_PER_UNIT_USD = ROBUX_RATE_PER_1000_USD / 1000;

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

function buildApiUrl(path: string) {
  if (ROBLOX_PROXY_BASE) {
    return `${ROBLOX_PROXY_BASE}/roblox-proxy?url=${encodeURIComponent(`https://${path}`)}`;
  }
  return `https://${path}`;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getGiftValue(amount: number) {
  if (!amount || amount <= 0) return 0;
  return Number((amount * ROBUX_RATE_PER_UNIT_USD).toFixed(2));
}

function clampPositiveInteger(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.floor(value);
}

function RobuxMark({ small = false }: { small?: boolean }) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden",
        small ? "h-5 w-5" : "h-8 w-8"
      )}
      title="Replace this component with your Robux icon image"
    >
      {/**
       * GANTI ICON ROBUX DI SINI:
       * Tukar blok <div className=...> di bawah kepada contoh ini bila icon kau dah ada:
       * <img src="/robux-icon.png" alt="Robux" className={cn(small ? "h-5 w-5" : "h-8 w-8", "object-contain")} />
       */}
      <div
        className={cn(
          "rotate-45 rounded-[4px] border border-slate-300 bg-slate-900 shadow-[0_6px_14px_rgba(15,23,42,0.12)]",
          small ? "h-2.5 w-2.5" : "h-4 w-4"
        )}
      />
    </div>
  );
}

function Avatar({ username, imageUrl }: { username: string; imageUrl?: string }) {
  const initials = username
    .split(/[_\s]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={username}
        className="h-12 w-12 rounded-2xl border border-white/80 bg-white/80 object-cover shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
      />
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f172a,#312e81,#0369a1)] text-xs font-black tracking-[0.2em] text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]">
      {initials || "RB"}
    </div>
  );
}

function Surface({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(
      "rounded-[30px] border border-white/70 bg-white/60 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl",
      className
    )}>
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function runLocalChecks() {
  console.assert(getGiftValue(1000) === 9.99, "1000 Robux should estimate to $9.99");
  console.assert(getGiftValue(80) === 0.8, "80 Robux should estimate to $0.80");
  console.assert(clampPositiveInteger(0) === 1, "Amount should clamp to minimum 1");
  console.assert(clampPositiveInteger(123.9) === 123, "Amount should floor to integer");
  console.assert(clampPositiveInteger(999) === 999, "Whole numbers should remain unchanged");
}

runLocalChecks();

export default function RobuxGiftCheckout() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<RobloxUser[]>([]);
  const [avatars, setAvatars] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<RobloxUser | null>(null);
  const [giftAmount, setGiftAmount] = useState(1000);
  const [submitted, setSubmitted] = useState(false);
  const [robuxBalance, setRobuxBalance] = useState(STARTING_ROBUX);
  const [balanceError, setBalanceError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const searchUsers = async () => {
      try {
        setLoading(true);
        setError("");

        const searchResponse = await fetch(
          buildApiUrl(`users.roblox.com/v1/users/search?keyword=${encodeURIComponent(debouncedQuery)}&limit=10`)
        );

        if (!searchResponse.ok) {
          let message = "Unable to search Roblox users right now.";
          try {
            const errorJson = await searchResponse.json();
            const apiMessage = errorJson?.errors?.[0]?.message;
            if (apiMessage) message = apiMessage;
          } catch {}
          throw new Error(message);
        }

        const searchJson = await searchResponse.json();
        const users: RobloxUser[] = Array.isArray(searchJson?.data) ? searchJson.data : [];

        if (cancelled) return;
        setResults(users);

        if (!users.length) {
          setAvatars({});
          return;
        }

        const userIds = users.map((user) => user.id).join(",");
        const thumbResponse = await fetch(
          buildApiUrl(`thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds}&size=150x150&format=Png&isCircular=false`)
        );

        if (!thumbResponse.ok) return;

        const thumbJson = await thumbResponse.json();
        const data: RobloxThumbnail[] = Array.isArray(thumbJson?.data) ? thumbJson.data : [];
        const nextAvatars = data.reduce<Record<number, string>>((acc, item) => {
          if (item.targetId && item.imageUrl) acc[item.targetId] = item.imageUrl;
          return acc;
        }, {});

        if (!cancelled) setAvatars(nextAvatars);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setAvatars({});
          setError(
            ROBLOX_PROXY_BASE
              ? err instanceof Error
                ? err.message
                : "Search failed."
              : "preview_blocked"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    searchUsers();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const activeAmount = clampPositiveInteger(giftAmount);
  const activePrice = getGiftValue(activeAmount);
  const canSubmit = !!selectedPlayer && activeAmount > 0;

  const helperText = useMemo(() => {
    if (!query.trim()) return "Search public Roblox usernames";
    if (loading) return "Searching Roblox players...";
    if (error === "preview_blocked") return "Live search unavailable right now";
    if (error) return error;
    if (results.length === 0) return "No players found";
    return `${results.length} player${results.length > 1 ? "s" : ""} found`;
  }, [query, loading, error, results.length]);

  const closeModal = () => {
    setSubmitted(false);
    setSelectedPlayer(null);
    setQuery("");
    setResults([]);
    setError("");
    setBalanceError("");
  };

  const handleGift = () => {
    setBalanceError("");
    if (!canSubmit) return;
    if (activeAmount > robuxBalance) {
      setBalanceError("Not enough Robux balance for this gift.");
      return;
    }
    setRobuxBalance((prev) => prev - activeAmount);
    setSubmitted(true);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#f7fbff_0%,_#eef2ff_34%,_#f8fafc_72%,_#ffffff_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.35)_1px,transparent_1px)] bg-[size:34px_34px] opacity-30" />
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-fuchsia-300/25 blur-3xl" />
        <div className="absolute right-[-40px] top-24 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="absolute bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-sm flex-col px-4 py-5">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Surface className="mb-4 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pr-1">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.26em] text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
                  <Gift className="h-3.5 w-3.5" /> ROBUX GIFT CENTER
                </div>
                <h1 className="text-[30px] font-black tracking-[-0.04em] text-slate-950">Robux Gift</h1>
              </div>

              <button className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/90 bg-white/85 px-3 py-2 text-xs font-black text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:translate-y-[-1px] hover:bg-white">
                <LogOut className="h-4 w-4" />
                Log Out
              </button>
            </div>

            <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0f172a_0%,#312e81_38%,#0369a1_100%)] p-[1px] shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
              <div className="relative overflow-hidden rounded-[27px] bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))] px-4 py-4 text-white backdrop-blur-xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_35%)]" />
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-sky-300/20 blur-2xl" />

                <div className="relative">
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/65">Available Robux</div>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 text-[26px] font-black tracking-[-0.03em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <RobuxMark />
                    <span className="tabular-nums">{robuxBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </Surface>
        </motion.div>

        <div className="space-y-3">
          <motion.section layout>
            <Surface className="p-4">
              <SectionTitle title="Recipient" subtitle="Search the Roblox player you want to gift" />

              <div className="relative mb-2 overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.86))] p-[1px] shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                <div className="relative rounded-[21px] bg-white/90">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search Roblox username"
                    className="w-full rounded-[21px] bg-transparent py-3.5 pl-10 pr-11 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  {loading ? (
                    <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                  ) : (
                    <RefreshCw className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                  )}
                </div>
              </div>

              <div className={cn("mb-3 text-xs", error ? "text-amber-700" : "text-slate-500")}>{helperText}</div>

              <div className="space-y-2">
                {results.length > 0 ? (
                  results.map((player) => {
                    const active = selectedPlayer?.id === player.id;
                    const profileUrl = `https://www.roblox.com/users/${player.id}/profile`;
                    return (
                      <div
                        key={player.id}
                        className={cn(
                          "rounded-[24px] p-[1px] transition-all duration-200",
                          active
                            ? "bg-[linear-gradient(135deg,#8b5cf6,#38bdf8,#34d399)] shadow-[0_20px_40px_rgba(56,189,248,0.18)]"
                            : "bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.72))] shadow-[0_12px_24px_rgba(15,23,42,0.05)]"
                        )}
                      >
                        <div
                          className={cn(
                            "rounded-[23px] px-3 py-3",
                            active ? "bg-slate-950 text-white" : "bg-white/92 text-slate-900"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedPlayer(player)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <Avatar username={player.name} imageUrl={avatars[player.id]} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <div className="truncate text-sm font-black">@{player.name}</div>
                                  {player.hasVerifiedBadge && <BadgeCheck className="h-4 w-4 shrink-0" />}
                                </div>
                                <div className={cn("truncate text-xs", active ? "text-slate-300" : "text-slate-500")}>
                                  {player.displayName || player.name}
                                </div>
                              </div>
                            </button>

                            <a
                              href={profileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                                active
                                  ? "border-white/10 bg-white/10 text-white"
                                  : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-white"
                              )}
                              aria-label={`Open ${player.name} profile`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[24px] border border-dashed border-white/90 bg-white/55 px-4 py-5 text-center text-xs text-slate-500 backdrop-blur-sm">
                    Start typing to search Roblox players.
                  </div>
                )}
              </div>

              {error === "preview_blocked" && (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3 text-xs text-amber-800 shadow-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Live username search needs a small proxy after deployment. The preview here cannot call Roblox directly.</span>
                </div>
              )}
            </Surface>
          </motion.section>

          <motion.section layout>
            <Surface className="p-4">
              <SectionTitle title="Gift Amount" subtitle="Enter the amount of Robux you want to gift" />

              <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#d946ef_0%,#7c3aed_42%,#0284c7_100%)] p-[1px] shadow-[0_22px_46px_rgba(79,70,229,0.16)]">
                <div className="relative overflow-hidden rounded-[27px] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.82))] p-4 backdrop-blur-xl">
                  <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-fuchsia-200/60 blur-2xl" />
                  <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-sky-200/60 blur-2xl" />

                  <div className="relative">
                    <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
                      <RobuxMark />
                      Amount
                    </div>

                    <div className="rounded-[24px] border border-white/90 bg-white/80 px-4 py-4 shadow-[0_18px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Gift amount</div>
                      <div className="flex items-end justify-between gap-3">
                        <input
                          type="number"
                          min={1}
                          value={giftAmount}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setGiftAmount(clampPositiveInteger(next));
                          }}
                          placeholder="Enter Robux amount"
                          className="w-full bg-transparent text-[36px] font-black tracking-[-0.04em] text-slate-950 outline-none placeholder:text-slate-300"
                        />
                        <div className="mb-2 shrink-0 opacity-90">
                          <RobuxMark />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Surface>
          </motion.section>

          <motion.section layout>
            <div className="rounded-[32px] bg-[linear-gradient(135deg,#020617_0%,#1e1b4b_48%,#0f172a_100%)] p-[1px] shadow-[0_26px_60px_rgba(15,23,42,0.20)]">
              <div className="rounded-[31px] bg-[linear-gradient(160deg,rgba(15,23,42,0.985),rgba(30,41,59,0.96))] p-4 text-white">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Summary</div>
                    <h3 className="mt-1 text-lg font-black tracking-[-0.03em]">Gift Review</h3>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-200 shadow-inner">
                    Ready
                  </div>
                </div>

                <div className="space-y-2 rounded-[24px] border border-white/8 bg-white/5 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Recipient</span>
                    <span className="max-w-[150px] truncate font-bold">{selectedPlayer ? `@${selectedPlayer.name}` : "Not selected"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Display</span>
                    <span className="max-w-[150px] truncate font-bold">{selectedPlayer?.displayName || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Gift</span>
                    <span className="flex items-center gap-2 font-bold">
                      <RobuxMark small /> {activeAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Estimated value</span>
                    <span className="font-bold">{formatUsd(activePrice)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Balance after</span>
                    <span className="inline-flex items-center gap-1.5 font-bold tabular-nums">
                      <RobuxMark small /> {Math.max(0, robuxBalance - activeAmount).toLocaleString()}
                    </span>
                  </div>
                </div>

                {balanceError && (
                  <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
                    {balanceError}
                  </div>
                )}

                <button
                  onClick={handleGift}
                  disabled={!canSubmit}
                  className={cn(
                    "mt-3 flex w-full items-center justify-center gap-2 rounded-[24px] px-4 py-3.5 text-sm font-black transition-all duration-200",
                    canSubmit
                      ? "bg-[linear-gradient(180deg,#ffffff,#f1f5f9)] text-slate-950 shadow-[0_18px_38px_rgba(255,255,255,0.14)] hover:-translate-y-0.5"
                      : "cursor-not-allowed bg-white/10 text-slate-500"
                  )}
                >
                  <Gift className="h-4 w-4" />
                  Send Gift
                </button>
              </div>
            </div>
          </motion.section>
        </div>

        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-[3px]"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="w-full max-w-sm rounded-[32px] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-[1px] shadow-[0_28px_80px_rgba(16,185,129,0.16)]"
              >
                <div className="rounded-[31px] border border-white/80 bg-white/85 p-4 backdrop-blur-xl">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
                        <Check className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black tracking-tight text-slate-950">Gift sent</h4>
                          <Star className="h-4 w-4 text-amber-500" />
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          <span className="font-bold">{activeAmount.toLocaleString()} Robux</span> has been sent to <span className="font-bold">@{selectedPlayer?.name}</span>.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={closeModal}
                      className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/90 bg-white/85 text-slate-500 shadow-sm transition hover:bg-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="rounded-[24px] border border-white/80 bg-white/80 p-3 text-[11px] text-slate-600 shadow-[0_12px_26px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between">
                      <span>Reference</span>
                      <span className="font-bold">RBX-GIFT-2026</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>Recipient</span>
                      <span className="font-bold">@{selectedPlayer?.name}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>Gift amount</span>
                      <span className="font-bold">{activeAmount.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>Estimated value</span>
                      <span className="font-bold">{formatUsd(activePrice)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>Remaining balance</span>
                      <span className="font-bold">{robuxBalance.toLocaleString()} Robux</span>
                    </div>
                  </div>

                  <button
                    onClick={closeModal}
                    className="mt-3 w-full rounded-[24px] bg-[linear-gradient(135deg,#020617_0%,#312e81_45%,#0f172a_100%)] px-4 py-3 text-sm font-black text-white shadow-[0_18px_38px_rgba(15,23,42,0.18)] transition hover:translate-y-[-1px]"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
