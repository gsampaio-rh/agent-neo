export interface PlanSummary {
  filename: string;
  title: string;
  mtime: string;
}

export interface PlanDetail {
  filename: string;
  title: string;
  content: string;
}

export async function listPlans(): Promise<{ plans: PlanSummary[] }> {
  const res = await fetch('/api/plans');
  if (!res.ok) return { plans: [] };
  return res.json();
}

export async function getPlan(filename: string): Promise<PlanDetail> {
  const res = await fetch(`/api/plans/${encodeURIComponent(filename)}`);
  if (!res.ok) throw new Error(`Failed to get plan ${filename}`);
  return res.json();
}
