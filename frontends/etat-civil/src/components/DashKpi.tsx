import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function useCountUp(target: number, durationMs = 700): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target <= 0) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return n;
}

/** Carte KPI du tableau de bord : total validé + « N à valider », cliquable vers la liste. */
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  href,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: ReactNode;
  color: string;
  href?: string;
}) {
  const shown = useCountUp(value);
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="dash-kpi"
      onClick={() => {
        if (href) navigate(href);
      }}
      style={href ? undefined : { cursor: "default" }}
    >
      <div className="dash-kpi-top">
        <span className="dash-kpi-icon" style={{ background: `${color}18`, color }}>
          {icon}
        </span>
      </div>
      <div className="dash-kpi-title">{title}</div>
      <div className="dash-kpi-value">{shown.toLocaleString("fr-CD")}</div>
      <div className="dash-kpi-foot">
        <span className="dash-kpi-sub">{subtitle}</span>
      </div>
    </button>
  );
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function lastNMonths(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: MONTHS_FR[d.getMonth()] });
  }
  return out;
}

export function countByMonth(acts: Array<{ created_at: string }>, months: { key: string }[]): number[] {
  const map = new Map(months.map((m) => [m.key, 0]));
  for (const a of acts) {
    const d = new Date(a.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const k = monthKey(d);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return months.map((m) => map.get(m.key) ?? 0);
}
