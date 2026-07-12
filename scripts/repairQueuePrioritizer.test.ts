import assert from "node:assert/strict";
import { prioritizeRepairQueue } from "../lib/repairQueuePrioritizer";
const items: any[] = [{ candidateName: "b", priority: "P2", sortScore: 2000 }, { candidateName: "a", priority: "P0", sortScore: 0 }, { candidateName: "c", priority: "P1", sortScore: 1000 }];
assert.deepEqual(prioritizeRepairQueue(items).map((item) => item.priority), ["P0", "P1", "P2"], "priority sorting P0 before P1 before P2");
console.log("Repair queue prioritizer tests passed");
