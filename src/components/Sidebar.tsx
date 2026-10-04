"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { NAV } from "@/lib/nav";
import { pageColor } from "@/lib/page-colors";
import { setTargetBand } from "@/lib/actions/settings";
import { fmtBand } from "@/lib/ielts";

export function Sidebar({
  dueBadge,
  targetBand,
  daysLeft,
}: {
  dueBadge: number;
  targetBand: number;
  daysLeft: number | null;
}) {
  const pathname = usePathname();
  const [target, setTarget] = useState(targetBand);
  const [, start] = useTransition();

  const bump = (delta: number) => {
    const next = Math.min(9, Math.max(4, target + delta));
    setTarget(next);
    start(async () => {
      const saved = await setTargetBand(delta);
      setTarget(saved);
    });
  };

  const sideDays =
    daysLeft == null ? "Set your exam date" : daysLeft > 0 ? `${daysLeft} days to exam` : "Exam date reached";

  return (
    <nav aria-label="Main" className="self-stretch bg-sidebar text-white" style={{ flex: "1 1 220px", maxWidth: "100%", padding: "24px 16px" }}>
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent font-heading text-lg font-bold text-ink">B</div>
        <div>
          <div className="font-heading text-lg font-bold">Band Up</div>
          <div className="text-xs text-on-dark">IELTS study hub</div>
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        {NAV.map((n) => {
          const on = pathname === n.href;
          const badge = n.badgeKey === "due" && dueBadge > 0 ? String(dueBadge) : "";
          return (
            <div key={n.href}>
              {n.head && (
                <div className="px-3.5 pb-1.5 pt-4 text-[11px] uppercase tracking-[0.1em] text-on-dark-3">{n.head}</div>
              )}
              <Link href={n.href} className="nav" aria-current={on ? "page" : undefined}>
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 flex-none rounded-[3px]"
                    style={{ background: pageColor(n.href) }}
                  />
                  {n.label}
                </span>
                {badge && (
                  <span className="min-w-[22px] rounded-[11px] bg-accent px-[7px] py-0.5 text-center text-xs font-semibold text-ink">
                    {badge}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </div>
      <div className="mx-2 mt-6 rounded-[10px] bg-ink-2 p-3.5">
        <div className="text-xs uppercase tracking-[0.08em] text-on-dark">Target band</div>
        <div className="mt-2 flex items-center gap-2.5">
          <button className="btn btn-dark min-w-10" aria-label="Lower target" onClick={() => bump(-0.5)}>−</button>
          <div className="flex-1 text-center font-heading text-3xl font-bold">{fmtBand(target)}</div>
          <button className="btn btn-dark min-w-10" aria-label="Raise target" onClick={() => bump(0.5)}>+</button>
        </div>
        <div className="mt-2 text-center text-[13px] text-on-dark-2">{sideDays}</div>
      </div>
    </nav>
  );
}
