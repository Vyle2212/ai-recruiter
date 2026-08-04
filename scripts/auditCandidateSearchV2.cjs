const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

const targets = [
  "app/search/page.tsx",
  "app/recruiter/talent-search/page.tsx",
  "app/recruiter/talent-search/results/page.tsx",
  "app/api/search-candidates/route.ts",
  "app/api/vector-search/route.ts",
  "lib/searchIntentParser.ts",
  "lib/semanticSearch.ts",
  "lib/candidateSearchIndex.ts",
  "lib/candidateVectorRanking.ts",
  "lib/recruiterTalentSearchResults.ts",
  "lib/search/buildSearchIndexRow.ts",
  "lib/search/rebuildSearchIndex.ts",
];

const featurePatterns = {
  keywordSearch: [
    /keyword/i,
    /query/i,
    /searchTerm/i,
  ],
  semanticSearch: [
    /semantic/i,
    /embedding/i,
    /vector/i,
  ],
  hybridSearch: [
    /hybrid/i,
    /keywordScore/i,
    /semanticScore/i,
  ],
  filters: [
    /location/i,
    /salary/i,
    /noticePeriod/i,
    /experience/i,
    /skills/i,
  ],
  pagination: [
    /pageSize/i,
    /offset/i,
    /cursor/i,
    /pagination/i,
  ],
  ranking: [
    /rank/i,
    /score/i,
    /relevance/i,
  ],
  explainability: [
    /reason/i,
    /explain/i,
    /evidence/i,
  ],
  savedSearch: [
    /savedSearch/i,
    /save search/i,
  ],
};

const report = {
  generatedAt: new Date().toISOString(),
  files: [],
  summary: {},
};

for (const relativePath of targets) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    report.files.push({
      path: relativePath,
      exists: false,
      lines: 0,
      features: {},
    });

    continue;
  }

  const source = fs.readFileSync(
    absolutePath,
    "utf8",
  );

  const features = {};

  for (const [
    feature,
    patterns,
  ] of Object.entries(
    featurePatterns,
  )) {
    features[feature] =
      patterns.some(
        (pattern) =>
          pattern.test(source),
      );
  }

  report.files.push({
    path: relativePath,
    exists: true,
    lines:
      source.split(/\r?\n/).length,
    features,
  });
}

for (const feature of Object.keys(
  featurePatterns,
)) {
  report.summary[feature] =
    report.files.filter(
      (file) =>
        file.exists &&
        file.features[feature],
    ).map(
      (file) =>
        file.path,
    );
}

const reportsDirectory =
  path.join(
    root,
    "reports",
  );

fs.mkdirSync(
  reportsDirectory,
  {
    recursive: true,
  },
);

const jsonPath =
  path.join(
    reportsDirectory,
    "candidate-search-v2-audit.json",
  );

const markdownPath =
  path.join(
    reportsDirectory,
    "candidate-search-v2-audit.md",
  );

fs.writeFileSync(
  jsonPath,
  JSON.stringify(
    report,
    null,
    2,
  ) + "\n",
  "utf8",
);

const markdown = [
  "# Candidate Search V2 Audit",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  "## Files",
  "",
  "| File | Exists | Lines |",
  "|---|---:|---:|",
  ...report.files.map(
    (file) =>
      `| \`${file.path}\` | ${file.exists ? "Yes" : "No"} | ${file.lines} |`,
  ),
  "",
  "## Feature coverage",
  "",
  ...Object.entries(
    report.summary,
  ).flatMap(
    ([feature, files]) => [
      `### ${feature}`,
      "",
      ...(files.length
        ? files.map(
            (file) =>
              `- \`${file}\``,
          )
        : [
            "- Not detected",
          ]),
      "",
    ],
  ),
].join("\n");

fs.writeFileSync(
  markdownPath,
  markdown + "\n",
  "utf8",
);

console.log(
  "Candidate Search V2 audit completed.",
);

console.log(
  `JSON: ${path.relative(root, jsonPath)}`,
);

console.log(
  `Markdown: ${path.relative(root, markdownPath)}`,
);