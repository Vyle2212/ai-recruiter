import assert from "node:assert/strict";
import {
  projectsDescribeSameAssignment,
  type EnterpriseProject,
} from "../lib/candidate360SchemaNormalize";

function project(overrides: Partial<EnterpriseProject>): EnterpriseProject {
  return {
    id: "synthetic-project",
    name: "",
    client: "Example Retail Group",
    industry: "",
    country: "",
    role: "Senior ERP Consultant",
    modules: ["ERP"],
    projectType: "Migration",
    implementationType: "Migration",
    start: "Mar 2022",
    end: "Apr 2023",
    duration: "1 year 1 month",
    responsibilities: ["Delivered ERP migration testing."],
    teamSize: null,
    environment: "",
    evidenceState: "source_extracted",
    fieldEvidence: {},
    ...overrides,
  };
}

const datedExtraction = project({ id: "dated-extraction" });
const structuredDuplicate = project({
  id: "structured-duplicate",
  role: "ERP Team Lead",
  start: "",
  end: "",
  duration: null,
});
assert.equal(
  projectsDescribeSameAssignment(datedExtraction, structuredDuplicate),
  true,
  "different inferred and structured role labels may merge only when the client and source responsibility are identical",
);

assert.equal(
  projectsDescribeSameAssignment(
    datedExtraction,
    project({
      id: "distinct-delivery",
      role: "ERP Team Lead",
      start: "",
      end: "",
      duration: null,
      responsibilities: ["Led solution design approvals."],
    }),
  ),
  false,
  "different role kinds with different responsibilities remain separate assignments",
);

assert.equal(
  projectsDescribeSameAssignment(
    datedExtraction,
    project({
      id: "other-client",
      client: "Example Manufacturing Group",
      role: "ERP Team Lead",
      start: "",
      end: "",
      duration: null,
    }),
  ),
  false,
  "identical responsibility text never joins different clients",
);

console.log("Project role provenance deduplication tests passed.");
