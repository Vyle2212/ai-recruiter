import { applyQuickFixWorkflowRefresh } from "../lib/quickFixWorkflowRefreshApply";

function has(flag: string) { return process.argv.includes(flag); }

async function main() {
  const writeWorkflowState = has("--writeWorkflowState");
  const confirmWorkflowRefresh = has("--confirmWorkflowRefresh");
  const dryRun = has("--dryRun") || has("--noApply") || !writeWorkflowState;

  if (writeWorkflowState !== confirmWorkflowRefresh) {
    throw new Error(writeWorkflowState ? "--writeWorkflowState requires --confirmWorkflowRefresh" : "--confirmWorkflowRefresh requires --writeWorkflowState");
  }

  const result: any = applyQuickFixWorkflowRefresh({ writeWorkflowState, confirmWorkflowRefresh });
  if (writeWorkflowState) {
    console.log("CONFIRMED QUICK FIX WORKFLOW REFRESH. Workflow state updates enabled.");
    console.log(`Backup written: ${result.backupPath}`);
    console.log(`Rollback written: ${result.rollbackPath}`);
    console.log(`Applied workflow updates: ${result.appliedWorkflowUpdates}`);
    console.log(`Moved out of needs_repair: ${result.movedOutOfNeedsRepair}`);
    console.log(`Became ready_for_shortlist: ${result.becameReadyForShortlist}`);
    console.log(`Output path: ${result.resultPath}`);
    return;
  }

  console.log(dryRun ? "Mode: workflow refresh apply preview only; no workflow writes" : "Mode: workflow refresh apply preview only; no workflow writes");
  console.log(`Candidates analyzed: ${result.candidatesAnalyzed}`);
  console.log(`Eligible workflow updates: ${result.eligibleWorkflowUpdates}`);
  console.log(`Blocked workflow updates: ${result.blockedWorkflowUpdates}`);
  console.log(`Would move out of needs_repair: ${result.wouldMoveOutOfNeedsRepair}`);
  console.log(`Would become ready_for_shortlist: ${result.wouldBecomeReadyForShortlist}`);
  console.log(`Backup required: ${result.backupRequired}`);
  console.log(`Rollback ready: ${result.rollbackReady}`);
  console.log(`Output path: ${result.resultPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/applyQuickFixWorkflowRefresh.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}

