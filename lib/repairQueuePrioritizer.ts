import type { RepairPriority, RepairQueueItem } from "./repairQueueTypes";

const RANK: Record<RepairPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };

export function prioritizeRepairQueue(items: RepairQueueItem[]) {
  return [...items].sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.sortScore - b.sortScore || a.candidateName.localeCompare(b.candidateName));
}
