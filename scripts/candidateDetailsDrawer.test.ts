import assert from "node:assert/strict";
import fs from "node:fs";

const drawer = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateDetailsDrawer.tsx",
  "utf8",
);
const search = fs.readFileSync(
  "app/recruiter/talent-search/v2/CandidateSearchV2Client.tsx",
  "utf8",
);
const route = fs.readFileSync(
  "app/api/recruiter/search-v2/candidate-details/[candidateId]/route.ts",
  "utf8",
);
const overview = fs.readFileSync(
  "components/CanonicalProfileOverview.tsx",
  "utf8",
);

assert.match(
  drawer,
  /const TABS = \[\s*"Overview",\s*"Experience",\s*"Projects",\s*"Education",\s*"Skills",?\s*\] as const/,
  "the ordered tab vocabulary remains stable",
);
assert.match(drawer, /fixed inset-0 z-50 overflow-hidden/);
assert.match(drawer, /inset-y-0 right-0/);
assert.match(drawer, /sm:w-\[min\(48vw,880px\)\]/);
assert.match(drawer, /h-\[100dvh\] w-full/);
assert.match(drawer, /flex-1 overflow-y-auto/);
assert.match(drawer, /event\.key === "Escape"/);
assert.match(drawer, /event\.key !== "Tab"/);
assert.match(drawer, /Previous visible candidate/);
assert.match(drawer, /Next visible candidate/);
assert.match(drawer, /setTab\("Overview"\)/);
assert.match(drawer, /data-testid="candidate-detail-scroll-container"/);
assert.match(
  drawer,
  /resetCandidateDetailsScroll\(contentScrollRef\.current\)/,
);
assert.match(drawer, /\[tab, candidate\.candidateId\]/);
assert.doesNotMatch(
  drawer,
  /Panel title=\{identityLookup \? "Identity lookup"/,
);
assert.doesNotMatch(overview, /sourceContext/);
assert.match(drawer, /Requirement coverage/);
assert.match(drawer, /enterprise\?\.employmentTimeline/);
assert.match(drawer, /enterprise\?\.projects/);
assert.doesNotMatch(drawer, /fieldEvidence/);
assert.match(drawer, /candidateProfileTabState\(overview\)/);
assert.match(drawer, /canonicalCandidateSkillCollection\(overview\)/);
assert.doesNotMatch(drawer, /aria-disabled=\{!enabled\}/);
assert.doesNotMatch(drawer, /disabled=\{!enabled\}/);
assert.match(drawer, /No information available/);
assert.match(drawer, /candidateProfileTabLabel\(item, count, hasRecords\)/);
assert.doesNotMatch(drawer, /count == null \? "" : ` \(\$\{count\}\)`/);
assert.doesNotMatch(drawer, /Profile identity incomplete/);
assert.match(drawer, /`Candidate \$\{canonicalIdentity\.identityToken\}`/);
assert.match(drawer, /Name not provided/);
assert.match(drawer, /tab === "Experience"/);
assert.match(drawer, /tab === "Projects"/);
assert.match(drawer, /tab === "Education"/);
assert.match(drawer, /tab === "Skills"/);
assert.match(
  drawer,
  /No grounded employment history was provided in the selected[\s\S]*profile source/,
);
assert.match(
  drawer,
  /No grounded project history was found in the selected[\s\S]*profile source/,
);
assert.match(
  drawer,
  /No education, qualifications, certifications or training[\s\S]*information was provided in the selected profile source/,
);
assert.match(
  drawer,
  /No grounded skills were found in the selected profile[\s\S]*source/,
);
assert.match(drawer, /Try again/);
assert.match(drawer, /Training and courses/);
assert.doesNotMatch(drawer, /Source details/);
assert.doesNotMatch(drawer, />From profile</);
assert.doesNotMatch(drawer, /No responsibilities provided\.<\/p>/);
assert.doesNotMatch(drawer, /item\.provenance/);
assert.match(drawer, /<ProjectSummary/);
assert.doesNotMatch(drawer, /return normalized\.slice\(0, max\)/);
assert.doesNotMatch(drawer, /Notes remain read-only/);
assert.match(drawer, /diagnostic\.requirements\.map/);
assert.doesNotMatch(drawer, /historical search/);
assert.match(drawer, /Open full profile/);
assert.doesNotMatch(drawer, />Decision</);
assert.doesNotMatch(drawer, />Candidate ?360</i);

assert.match(search, /data-candidate-details-trigger=\{result\.candidateId\}/);
assert.match(search, /aria-controls="candidate-details-drawer"/);
assert.match(search, /false && expanded && integrity/);
assert.match(search, /<CandidateDetailsDrawer/);
assert.match(search, /requestAnimationFrame/);
assert.match(search, /trigger\?\.focus\(\)/);
assert.match(search, /onSelect=\{\(candidateId\) => \{/);
assert.match(search, /setDrawerInitialTab\("Overview"\)/);
assert.match(search, /setExpandedCandidateId\(candidateId\)/);

assert.match(route, /authorizeRecruiterJobsRead\(\)/);
assert.match(route, /loadSearchV2CandidateDetail/);
assert.match(route, /X-Candidate-Detail-Cache/);
assert.match(route, /Cache-Control": "private, no-store"/);
assert.match(drawer, /cache: "no-store"/);
assert.match(drawer, /profile\.contractVersion !==/);
assert.match(drawer, /aria-label="Close candidate details"\s+tabIndex=\{-1\}/);

console.log("candidate details drawer tests passed");
