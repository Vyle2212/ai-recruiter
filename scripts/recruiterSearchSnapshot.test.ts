import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { beginSearchSnapshot, commitSearchSnapshot, failSearchSnapshot, type SearchSnapshotState } from "../lib/recruiterSearchSnapshot";

type Intent = { target: string };
type Filters = { country: string };
type Response = { query: string; candidateIds: string[]; page: number };
type State = SearchSnapshotState<Intent, Filters, string, Response>;
const request = (query: string, target: string, page = 1) => ({ query, intent: { target }, filters: { country: "" }, matchQuality: "relevant", minimumScore: 20, searchKey: `${query}:${page}` });
let state: State = { latestRequestId: 0, pending: null, committed: { ...request("SAP Datasphere Malaysia", "DATASPHERE"), response: { query: "SAP Datasphere Malaysia", candidateIds: ["datasphere-a"], page: 1 } }, error: null };
state = beginSearchSnapshot(state, 1, request("SAP OTC Singapore", "OTC"));
assert.equal(state.committed?.intent.target, "DATASPHERE", "pending B cannot relabel committed A candidates");
assert.deepEqual(state.committed?.response.candidateIds, ["datasphere-a"]);
state = beginSearchSnapshot(state, 2, request("SAP CPI Singapore", "CPI"));
const lateA = commitSearchSnapshot(state, 1, { query: "SAP OTC Singapore", candidateIds: ["otc-a"], page: 1 });
assert.equal(lateA.committed?.intent.target, "DATASPHERE", "late prior response is ignored");
state = commitSearchSnapshot(state, 2, { query: "SAP CPI Singapore", candidateIds: ["cpi-a"], page: 1 });
assert.equal(state.committed?.query, state.committed?.response.query);
assert.equal(state.committed?.intent.target, "CPI");

state = beginSearchSnapshot(state, 3, request("SAP OTC", "OTC"));
state = beginSearchSnapshot(state, 4, request("SAP CPI", "CPI"));
state = beginSearchSnapshot(state, 5, request("SAP Datasphere", "DATASPHERE"));
state = commitSearchSnapshot(state, 3, { query: "SAP OTC", candidateIds: ["old-otc"], page: 1 });
state = commitSearchSnapshot(state, 4, { query: "SAP CPI", candidateIds: ["old-cpi"], page: 1 });
state = commitSearchSnapshot(state, 5, { query: "SAP Datasphere", candidateIds: ["new-ds"], page: 1 });
assert.deepEqual(state.committed?.response.candidateIds, ["new-ds"], "rapid submissions commit only latest");

state = beginSearchSnapshot(state, 6, request("SAP Datasphere", "DATASPHERE", 2));
state = beginSearchSnapshot(state, 7, request("SAP MBC Malaysia", "MBC", 1));
state = commitSearchSnapshot(state, 6, { query: "SAP Datasphere", candidateIds: ["old-page-2"], page: 2 });
assert.notDeepEqual(state.committed?.response.candidateIds, ["old-page-2"], "old pagination cannot overwrite a newer query");
state = failSearchSnapshot(state, 7, "network failure");
assert.equal(state.error, "network failure");
assert.deepEqual(state.committed?.response.candidateIds, ["new-ds"], "error preserves a consistent prior snapshot");

const client = fs.readFileSync(path.join(process.cwd(), "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx"), "utf8");
assert.match(client, /intent=\{committedIntent\}/);
assert.match(client, /committedSnapshot\?\.intent \|\| EMPTY_RECRUITER_INTENT/);
assert.doesNotMatch(client, /parseRecruiterSearchIntent\(committedSnapshot\?\.query \|\| query\)/);
assert.match(client, /latestRequestIdRef\.current !== requestId/);
assert.match(client, /activeAbortControllerRef\.current\?\.abort\(\)/);
assert.match(client, /paginationNavigation && committedSnapshot \? committedSnapshot\.query : query/);
assert.match(client, /paginationNavigation\s*&&\s*\(loading \|\| Boolean\(pendingSearchKeyRef\.current\)\)/);
assert.doesNotMatch(client, /intent=\{parsedIntent\}/);
console.log("recruiter search snapshot race tests passed");
