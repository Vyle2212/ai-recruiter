import { NextResponse } from "next/server";
import { buildQuickFixSubsetApplyPlan } from "../../../../../lib/quickFixApplySubsetExecutor";
export async function GET(){const plan=await buildQuickFixSubsetApplyPlan();return NextResponse.json({summary:{subsetItems:plan.stagedItemsLoaded,eligibleForApply:plan.fieldsEligibleForApply,blockedFromApply:plan.fieldsBlocked,backupRequired:plan.backupRequired,rollbackReady:plan.rollbackReady},plan});}
