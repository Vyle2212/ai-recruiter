import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type LockPackage = {
  name?: string;
  version?: string;
  license?: string | { type?: string };
  integrity?: string;
  dev?: boolean;
  optional?: boolean;
};

type PackageLock = {
  lockfileVersion?: number;
  packages?: Record<
    string,
    LockPackage & {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }
  >;
};

const root = path.resolve(__dirname, "..");
const lockText = fs.readFileSync(path.join(root, "package-lock.json"), "utf8");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
) as PackageManifest;
const lock = JSON.parse(lockText) as PackageLock;
const rootLock = lock.packages?.[""];
assert.ok(
  lock.lockfileVersion && lock.lockfileVersion >= 3,
  "package-lock.json must use lockfile version 3 or newer",
);
assert.ok(rootLock, "package-lock.json must contain its root package entry");
assert.deepEqual(
  rootLock.dependencies || {},
  manifest.dependencies || {},
  "production dependency manifest and lockfile must match",
);
assert.deepEqual(
  rootLock.devDependencies || {},
  manifest.devDependencies || {},
  "development dependency manifest and lockfile must match",
);

const restrictivePattern =
  /(?:^|\s|\()(?:(?:A?GPL|SSPL|BUSL|Commons-Clause)(?:-|\s|$))/i;
const permissiveChoicePattern =
  /(?:MIT|Apache-2\.0|BSD-[23]-Clause|ISC).*\bOR\b|\bOR\b.*(?:MIT|Apache-2\.0|BSD-[23]-Clause|ISC)/i;
const components = Object.entries(lock.packages || {})
  .filter(([location, value]) => location && value.version)
  .map(([location, value]) => {
    const inferredName = location.slice(
      location.lastIndexOf("node_modules/") + "node_modules/".length,
    );
    const license =
      typeof value.license === "string"
        ? value.license
        : value.license?.type || "UNKNOWN";
    return {
      name: value.name || inferredName,
      version: value.version!,
      scope: value.dev ? "development" : "production",
      optional: Boolean(value.optional),
      license,
      integrity: value.integrity,
      integrityPresent: Boolean(value.integrity),
    };
  })
  .sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
  );

const direct = [
  ...Object.entries(manifest.dependencies || {}).map(([name, requested]) => ({
    name,
    requested,
    ownership: "production",
  })),
  ...Object.entries(manifest.devDependencies || {}).map(
    ([name, requested]) => ({ name, requested, ownership: "development" }),
  ),
].sort((a, b) => a.name.localeCompare(b.name));

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  lockfileVersion: lock.lockfileVersion,
  lockfileManifestMatch: true,
  packageCounts: {
    directProduction: Object.keys(manifest.dependencies || {}).length,
    directDevelopment: Object.keys(manifest.devDependencies || {}).length,
    installedInventory: components.length,
  },
  directDependencies: direct,
  licenses: {
    unknown: components
      .filter((item) => item.license === "UNKNOWN")
      .map((item) => `${item.name}@${item.version}`),
    restrictive: components
      .filter(
        (item) =>
          restrictivePattern.test(item.license) &&
          !permissiveChoicePattern.test(item.license),
      )
      .map((item) => ({
        package: `${item.name}@${item.version}`,
        license: item.license,
      })),
    inventory: components.map(({ name, version, scope, license }) => ({
      name,
      version,
      scope,
      license,
    })),
  },
  integrity: {
    packagesWithoutRegistryIntegrity: components
      .filter((item) => !item.integrityPresent)
      .map((item) => `${item.name}@${item.version}`),
  },
};

const artifacts = path.join(root, "artifacts");
fs.mkdirSync(artifacts, { recursive: true });
fs.writeFileSync(
  path.join(artifacts, "production-trust-supply-chain.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const digest = crypto.createHash("sha256").update(lockText).digest("hex");
const uuid = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
const productionComponentEntries = components
  .filter((item) => item.scope === "production")
  .map((item) => {
    const encodedName = item.name
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    const hash = item.integrity?.match(/^sha512-(.+)$/)?.[1];
    const bomRef = `pkg:npm/${encodedName}@${item.version}`;
    return [
      bomRef,
      {
        type: "library",
        "bom-ref": bomRef,
        name: item.name,
        version: item.version,
        purl: `pkg:npm/${encodedName}@${item.version}`,
        licenses:
          item.license === "UNKNOWN"
            ? undefined
            : [{ license: { name: item.license } }],
        hashes: hash
          ? [
              {
                alg: "SHA-512",
                content: Buffer.from(hash, "base64").toString("hex"),
              },
            ]
          : undefined,
      },
    ] as const;
  });
const productionComponents = Array.from(
  new Map(productionComponentEntries).values(),
);
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${uuid}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: "application",
      "bom-ref": "pkg:npm/ai-recruiter-final@0.1.0",
      name: "ai-recruiter-final",
      version: "0.1.0",
    },
  },
  components: productionComponents,
};
fs.writeFileSync(
  path.join(artifacts, "production-sbom.cdx.json"),
  JSON.stringify(sbom, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    lockfileManifestMatch: report.lockfileManifestMatch,
    directDependencies: direct.length,
    installedPackages: components.length,
    unknownLicenses: report.licenses.unknown.length,
    restrictiveLicenses: report.licenses.restrictive.length,
  }),
);
