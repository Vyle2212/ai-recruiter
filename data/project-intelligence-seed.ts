export type ProjectIntelligenceItem = { projectType: string; aliases: string[]; implementationWeight: number; consultingWeight: number; rankingPriority: number };

export const PROJECT_INTELLIGENCE_SEED: ProjectIntelligenceItem[] = [
  {
    "projectType": "Greenfield",
    "aliases": [
      "greenfield",
      "new implementation",
      "fresh implementation",
      "from scratch"
    ],
    "implementationWeight": 100,
    "consultingWeight": 95,
    "rankingPriority": 100
  },
  {
    "projectType": "Brownfield",
    "aliases": [
      "brownfield",
      "system conversion",
      "s/4 conversion",
      "ecc to s/4hana"
    ],
    "implementationWeight": 95,
    "consultingWeight": 90,
    "rankingPriority": 96
  },
  {
    "projectType": "Selective Transformation",
    "aliases": [
      "selective data transition",
      "bluefield",
      "carve-out",
      "snp crystalbridge"
    ],
    "implementationWeight": 95,
    "consultingWeight": 92,
    "rankingPriority": 94
  },
  {
    "projectType": "Rollout",
    "aliases": [
      "rollout",
      "roll out",
      "template rollout",
      "country rollout",
      "regional rollout"
    ],
    "implementationWeight": 82,
    "consultingWeight": 85,
    "rankingPriority": 84
  },
  {
    "projectType": "Implementation",
    "aliases": [
      "implementation",
      "end-to-end implementation",
      "full cycle",
      "full lifecycle"
    ],
    "implementationWeight": 90,
    "consultingWeight": 88,
    "rankingPriority": 90
  },
  {
    "projectType": "Migration",
    "aliases": [
      "migration",
      "data migration",
      "legacy migration",
      "ltmc",
      "cutover migration"
    ],
    "implementationWeight": 78,
    "consultingWeight": 74,
    "rankingPriority": 76
  },
  {
    "projectType": "Upgrade",
    "aliases": [
      "upgrade",
      "ehp upgrade",
      "technical upgrade",
      "version upgrade"
    ],
    "implementationWeight": 68,
    "consultingWeight": 65,
    "rankingPriority": 62
  },
  {
    "projectType": "AMS",
    "aliases": [
      "ams",
      "application management support",
      "managed services"
    ],
    "implementationWeight": 35,
    "consultingWeight": 45,
    "rankingPriority": 35
  },
  {
    "projectType": "Support",
    "aliases": [
      "support",
      "production support",
      "l2 support",
      "l3 support"
    ],
    "implementationWeight": 25,
    "consultingWeight": 35,
    "rankingPriority": 28
  },
  {
    "projectType": "Hypercare",
    "aliases": [
      "hypercare",
      "post go-live support",
      "go-live support"
    ],
    "implementationWeight": 70,
    "consultingWeight": 72,
    "rankingPriority": 68
  },
  {
    "projectType": "Cutover",
    "aliases": [
      "cutover",
      "cut-over",
      "go live preparation",
      "deployment weekend"
    ],
    "implementationWeight": 85,
    "consultingWeight": 82,
    "rankingPriority": 86
  },
  {
    "projectType": "Blueprint",
    "aliases": [
      "blueprint",
      "business blueprint",
      "solution blueprint"
    ],
    "implementationWeight": 80,
    "consultingWeight": 88,
    "rankingPriority": 82
  },
  {
    "projectType": "Fit-Gap",
    "aliases": [
      "fit gap",
      "fit-gap",
      "fit to standard",
      "fit-to-standard"
    ],
    "implementationWeight": 84,
    "consultingWeight": 92,
    "rankingPriority": 86
  },
  {
    "projectType": "UAT",
    "aliases": [
      "uat",
      "user acceptance testing",
      "test management"
    ],
    "implementationWeight": 60,
    "consultingWeight": 62,
    "rankingPriority": 58
  }
];
