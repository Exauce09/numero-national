/** Thin client — agrégats PostgreSQL uniquement (pas de fallback démo). */

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export type AggregateMetric = {
  metric_key: string;
  period?: string;
  value: number;
};

export async function fetchGovOverview(org: "presidency" | "primature" | "interior") {
  try {
    const res = await fetch(`${BASE}/gov/${org}/overview`);
    if (!res.ok) return { metrics: [] as AggregateMetric[], generated_at: "", source: "unavailable" };
    const data = (await res.json()) as {
      metrics?: AggregateMetric[];
      generated_at?: string;
      source?: string;
    };
    return {
      metrics: data.metrics ?? [],
      generated_at: data.generated_at ?? "",
      source: data.source ?? "postgresql",
    };
  } catch {
    return { metrics: [] as AggregateMetric[], generated_at: "", source: "unavailable" };
  }
}

export function metricValue(metrics: AggregateMetric[], key: string): number {
  return Number(metrics.find((m) => m.metric_key === key)?.value ?? 0);
}
