import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { recruiterApiPolicyForRequest } from "../lib/recruiterApiPolicyRegistry";

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
  const policies = methods.map((method) =>
    recruiterApiPolicyForRequest(route, method),
  );
  if (policies.some((policy) => !policy))
    throw new Error(`Missing recruiter API policy for ${route}`);
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
    policies: policies.map((policy) => ({
      id: policy!.id,
      methods: policy!.supportedMethods,
      requiredPermission: policy!.requiredPermission,
      readsCandidatePii: policy!.readsCandidatePii,
      persistentMutation: policy!.persistentMutation,
      serviceRoleAccess: policy!.serviceRoleAccess,
      invokesAi: policy!.invokesAi,
      invokesExternalProvider: policy!.invokesExternalProvider,
      auditCategory: policy!.auditCategory,
    })),
    authorization: centralSearchBoundary
      ? "global_policy_and_search_handler_authz"
      : source.includes("requireRecruiterApiRouteAuthorization")
        ? "global_policy_and_high_risk_handler_authz"
        : legacyRecruiterBoundary || directSessionAuthentication
          ? "global_policy_and_existing_inline_authz"
          : "global_policy_authn_and_permission_authz",
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
    (item) => item.authorization !== "global_policy_and_search_handler_authz",
  )
)
  throw new Error(
    "The complete Search V2 API family must use the strict boundary.",
  );

if (inventory.some((item) => item.policies.length !== item.methods.length))
  throw new Error("Every recruiter route method must have exactly one policy.");

console.log(
  JSON.stringify(
    {
      generatedFrom: "app/api/recruiter/**/route.ts",
      routeCount: inventory.length,
      exportedMethodCount: inventory.reduce(
        (total, item) => total + item.methods.length,
        0,
      ),
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
