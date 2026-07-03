import type { ExemptionStatus } from "../lib/types";

export function exemptionBadgeClass(tier: ExemptionStatus["tier"]) {
  if (tier === "exempt") {
    return "border-emerald-400/40 bg-emerald-500/20 text-emerald-100";
  }
  if (tier === "can_exempt") {
    return "border-cyan-400/40 bg-cyan-500/15 text-cyan-100";
  }
  return "border-amber-400/40 bg-amber-500/15 text-amber-100";
}

export function ExemptionBadge({ exemption }: { exemption: ExemptionStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${exemptionBadgeClass(exemption.tier)}`}
    >
      {exemption.shortLabel}
    </span>
  );
}

export function ExemptionBanner({ exemption }: { exemption: ExemptionStatus }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-center ${exemptionBadgeClass(exemption.tier)}`}
    >
      <p className="text-lg font-extrabold tracking-wide sm:text-xl">{exemption.label}</p>
    </div>
  );
}
