"use client";

import React, { useState } from "react";
import {
  Shield,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Star,
  CheckCircle,
  Clock,
  Send,
  Plus,
  Eye,
  EyeOff,
  ChevronRight,
  Flame,
} from "lucide-react";

/* ─── Tiers ─── */
const TIERS = [
  { name: "Bronze", min: 0, color: "bg-amber-700", coverage: "R 5k" },
  { name: "Silver", min: 500, color: "bg-neutral-400", coverage: "R 15k" },
  { name: "Gold", min: 2000, color: "bg-yellow-500", coverage: "R 40k" },
  { name: "Platinum", min: 5000, color: "bg-neutral-900", coverage: "R 100k" },
];

const CURRENT_TIER = {
  index: 1,
  name: "Silver",
  gradient: "from-neutral-300 to-neutral-500",
  coverage: "R 15,000",
  benefits: ["Extended health cover", "Prescriptions", "Family pool"],
};

const NEXT_TIER = { name: "Gold", min: 2000, gradient: "from-yellow-400 to-amber-500" };

/* ─── Mock data ─── */
const USER = {
  walletBalance: 1250.0,
  totalContributed: 3480.0,
  poolId: "MED-POOL-0042",
  poolMembers: 128,
  poolTotal: 64000.0,
  poolTarget: 100000.0,
  monthly: 150.0,
  nextPay: "15 Mar",
  claimsApproved: 3,
  claimsPending: 1,
  streak: 8,
};

const TXS = [
  { id: 1, label: "Monthly contribution", amount: -150, date: "1 Mar" },
  { id: 2, label: "Claim payout", amount: 450, date: "22 Feb" },
  { id: 3, label: "Monthly contribution", amount: -150, date: "1 Feb" },
  { id: 4, label: "Loyalty bonus", amount: 25, date: "28 Jan" },
  { id: 5, label: "Monthly contribution", amount: -150, date: "1 Jan" },
];

export default function WalletView() {
  const [showBalance, setShowBalance] = useState(true);
  const poolPct = Math.round((USER.poolTotal / USER.poolTarget) * 100);
  const tierPct = Math.min(100, Math.round(((USER.totalContributed - 500) / (2000 - 500)) * 100));

  return (
    <div className="h-full overflow-y-auto md:overflow-hidden bg-[#f5f5f7] flex flex-col safe-bottom">
      <div className="flex-1 flex flex-col gap-3 px-3 py-3 sm:px-5 sm:py-4 min-h-0">

        {/* ═══ HERO BALANCE CARD ═══ */}
        <div className="shrink-0 rounded-3xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 text-white px-4 py-4 sm:px-6 sm:py-5 shadow-lg shadow-red-900/30 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/[0.06]" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/[0.04]" />

          <div className="relative z-10">
            {/* Top row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-white/20 grid place-items-center">
                  <Shield className="h-4 w-4 text-red-100" />
                </div>
                <span className="text-[13px] font-medium text-white/70">InclusiV Wallet</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">
                <Flame className="h-3 w-3 text-red-200" />
                <span className="text-[11px] font-bold text-white/80">{USER.streak}mo</span>
              </div>
            </div>

            {/* Balance */}
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-white/50 uppercase tracking-widest font-medium mb-1">Available Balance</p>
                <div className="flex items-center gap-3">
                  <p className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                    {showBalance ? `R ${USER.walletBalance.toLocaleString()}` : "R ••••"}
                  </p>
                  <button
                    onClick={() => setShowBalance(!showBalance)}
                    className="h-7 w-7 rounded-full bg-white/10 grid place-items-center hover:bg-white/20 transition-colors shrink-0"
                  >
                    {showBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <div className={`h-3 w-3 rounded-full bg-gradient-to-br ${CURRENT_TIER.gradient}`} />
                <span className="text-[12px] font-semibold text-white/60">{CURRENT_TIER.name} Tier</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-5">
              {[
                { icon: Plus, label: "Top Up" },
                { icon: Send, label: "Pay" },
                { icon: ArrowDownLeft, label: "Claim" },
                { icon: TrendingUp, label: "History" },
              ].map((a) => (
                <button
                  key={a.label}
                  className="flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] transition-colors"
                >
                  <a.icon className="h-4 w-4 text-white/80" />
                  <span className="text-[10px] font-medium text-white/60">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ BOTTOM GRID: stack on mobile, 2-col tablet, 3-col desktop ═══ */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:min-h-0">

          {/* ─ Col 1: Pool + Tier ─ */}
          <div className="flex flex-col gap-3 md:min-h-0">
            {/* Pool card */}
            <div className="rounded-2xl bg-white px-4 py-3.5 shadow-sm shadow-neutral-200/70 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold text-black">Community Pool</span>
                <span className="text-[10px] text-neutral-400 font-medium">{poolPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400"
                  style={{ width: `${poolPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {USER.poolMembers} members</span>
                <span>R {(USER.poolTotal / 1000).toFixed(0)}k / R {(USER.poolTarget / 1000).toFixed(0)}k</span>
              </div>
            </div>

            {/* Tier card */}
            <div className="rounded-2xl bg-white shadow-sm shadow-neutral-200/70 overflow-hidden md:flex-1 flex flex-col md:min-h-0">
              <div className={`bg-gradient-to-br ${CURRENT_TIER.gradient} px-4 py-3 text-white shrink-0`}>
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-sm grid place-items-center">
                    <Star className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-base font-extrabold leading-tight">{CURRENT_TIER.name}</p>
                    <p className="text-[10px] text-white/70">Cover up to {CURRENT_TIER.coverage}</p>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 flex-1 flex flex-col gap-2 overflow-hidden">
                <ul className="space-y-1.5">
                  {CURRENT_TIER.benefits.map((b) => (
                    <li key={b} className="flex items-center gap-1.5 text-[11px] text-neutral-600">
                      <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2 border-t border-neutral-100">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-neutral-400">→ {NEXT_TIER.name}</span>
                    <span className="font-bold text-neutral-600">{tierPct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${NEXT_TIER.gradient}`} style={{ width: `${tierPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─ Col 2: Financial + All Tiers ─ */}
          <div className="rounded-2xl bg-white px-4 py-3.5 shadow-sm shadow-neutral-200/70 flex flex-col gap-3 md:min-h-0 md:overflow-hidden">
            <h2 className="text-[12px] font-bold text-black shrink-0">Financials</h2>
            <div className="space-y-1.5 shrink-0">
              {[
                { l: "Monthly", v: `R ${USER.monthly}` },
                { l: "Next payment", v: USER.nextPay },
                { l: "Allocation", v: "70/30 split" },
                { l: "Claims", v: `${USER.claimsApproved} ✓  ${USER.claimsPending} pending` },
                { l: "Max cover", v: CURRENT_TIER.coverage },
              ].map((r) => (
                <div key={r.l} className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2">
                  <span className="text-[10px] text-neutral-500">{r.l}</span>
                  <span className="text-[10px] font-bold text-black">{r.v}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-2 border-t border-neutral-100 space-y-1.5">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">All Tiers</h3>
              {TIERS.map((t, i) => {
                const active = i === CURRENT_TIER.index;
                return (
                  <div
                    key={t.name}
                    className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-[10px] transition-colors ${
                      active ? "bg-red-600 text-white font-bold" : "text-neutral-400"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${active ? "bg-white" : t.color}`} />
                      <span>{t.name}</span>
                    </div>
                    <span className={active ? "text-white/80" : "font-medium"}>{t.coverage}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─ Col 3: Transactions ─ */}
          <div className="rounded-2xl bg-white px-4 py-3.5 shadow-sm shadow-neutral-200/70 flex flex-col md:min-h-0 md:overflow-hidden sm:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between mb-2.5 shrink-0">
              <h2 className="text-[12px] font-bold text-black">Transactions</h2>
              <button className="flex items-center gap-0.5 text-[10px] font-semibold text-neutral-400 hover:text-black transition-colors">
                All <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="md:flex-1 md:min-h-0 md:overflow-hidden">
              <div className="space-y-0.5">
                {TXS.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-neutral-50 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className={`grid h-8 w-8 place-items-center rounded-xl ${tx.amount > 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                        {tx.amount > 0 ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-black leading-tight">{tx.label}</p>
                        <p className="text-[9px] text-neutral-400 flex items-center gap-0.5 mt-0.5">
                          <Clock className="h-2.5 w-2.5" /> {tx.date}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold tabular-nums ${tx.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {tx.amount > 0 ? "+" : "−"}R{Math.abs(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
