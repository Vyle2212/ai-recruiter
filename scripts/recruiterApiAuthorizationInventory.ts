import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "app", "api", "recruiter");
const routes: string[] = [];
function visit(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (entry.name === "route.ts") routes.push(target);
  }
}
visit(root);

const inventory = routes.sort().map((file) => {
  const source = readFileSync(file, "utf8");
  const route =
    "/api/recruiter/" +
    path.relative(root, path.dirname(file)).split(path.sep).join("/");
  const methods = [
    ...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g),
  ].map((match) => match[1]);
  const centralSearchBoundary = source.includes(
    "requireRecruiterSearchAuthorization",
  );
  const legacyRecruiterBoundary = source.includes("authorizeRecruiterJobsRead");
  const directSessionAuthentication = /auth\.getUser\s*\(/.test(source);
  const serviceRole =
    /createCandidateSupabaseAdminClient|SUPABASE_SERVICE_ROLE|service[_-]?role/i.test(
      source,
    ) ||
    [
      "/api/recruiter/search-v2",
      "/api/recruiter/search-v2/candidate-details/[candidateId]",
    ].includes(route);
  const candidatePii = ![
    "/api/recruiter/search-v2/guided-intent",
    "/api/recruiter/search-v2/guided-source",
    "/api/recruiter/search-v2/history",
  ].includes(route);
  const externalProvider =
    /externalTalentProvider\(\)\.capability|executeExternalTalentSearch|linkedinSourcingProvider\(\)\.search/.test(
      source,
    );
  const aiProvider =
    /generateExternalTalentAnalysis\s*\(|proposeGuidedSourcingPlan\s*\(/.test(
      source,
    );
  return {
    route,
    methods,
    authorization: centralSearchBoundary
      ? "strict_search_v2_authn_and_role_authz"
      : legacyRecruiterBoundary
        ? "legacy_recruiter_authn_and_role_authz"
        : directSessionAuthentication
          ? "authentication_only_or_inline_unknown"
          : "no_route_boundary_ui_proxy_not_sufficient",
    serviceRoleAccess: serviceRole
      ? source.includes("createClient(") ||
        source.includes("SUPABASE_SERVICE_ROLE")
        ? "direct"
        : "transitive_candidate_data_layer"
      : "none_detected",
    candidatePiiAccess: candidatePii
      ? "confirmed_or_conservatively_possible"
      : "none_detected",
    httpWriteMethod: methods.some((method) =>
      ["POST", "PUT", "PATCH", "DELETE"].includes(method),
    ),
    persistentMutation:
      methods.some((method) =>
        ["POST", "PUT", "PATCH", "DELETE"].includes(method),
      ) &&
      ![
        "/api/recruiter/search-v2",
        "/api/recruiter/search-v2/external-analysis",
        "/api/recruiter/search-v2/external-profile-import",
        "/api/recruiter/search-v2/guided-intent",
        "/api/recruiter/search-v2/guided-source",
      ].includes(route),
    externalProvider,
    aiProvider,
  };
});

const searchV2 = inventory.filter((item) =>
  item.route.startsWith("/api/recruiter/search-v2"),
);
if (
  searchV2.length !== 7 ||
  searchV2.some(
    (item) => item.authorization !== "strict_search_v2_authn_and_role_authz",
  )
)
  throw new Error(
    "The complete Search V2 API family must use the strict boundary.",
  );

console.log(
  JSON.stringify(
    {
      generatedFrom: "app/api/recruiter/**/route.ts",
      routeCount: inventory.length,
      summary: Object.fromEntries(
        [...new Set(inventory.map((item) => item.authorization))].map(
          (authorization) => [
            authorization,
            inventory.filter((item) => item.authorization === authorization)
              .length,
          ],
        ),
      ),
      inventory,
    },
    null,
    2,
  ),
);
