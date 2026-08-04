# Staging Auth Preflight CLI

This read-only CLI summarizes the staging authentication execution gate before implementation. It never enables authentication, executes SQL, contacts Supabase, or changes middleware.

## Commands

- `npm run staging-auth:preflight` — inspect normalized current safe flags; blocked is informational and exits 0.
- `npm run staging-auth:preflight -- --json` — emit the safe normalized report as JSON.
- `npm run staging-auth:preflight -- --strict` — exit 1 unless the staging gate is ready; this changes only the exit code.
- `npm run staging-auth:preflight -- --write-report` — opt in to `reports/staging-auth-preflight.json`.
- Simulations: `--simulate-empty`, `--simulate-local`, `--simulate-test`, `--simulate-production`, `--simulate-production-enabled`, `--simulate-staging-requested`, `--simulate-incomplete`, or `--simulate-approved`.

Exactly one simulation may be selected. Simulations use deterministic inputs and do not read current flags. The approved simulation is only a model of the ready state; it performs no action.

## Safe flag contract

The current-safe mode uses only the whitelisted, non-secret flags documented by the execution-gate environment contract: `APP_ENV`, `AUTH_MODE`, staging enablement/approval/evidence/review flags, and `PRODUCTION_AUTH_ENABLED`. Values are normalized immediately and are never printed. Supabase URLs, keys, tokens, passwords, project references, and connection strings are not inspected.

Missing configuration is blocked by default. Production is always blocked. Blocker keys identify unmet conditions without revealing values. Strict mode is suitable for CI because it fails on a blocked gate; informational mode remains successful so administrators can inspect blockers safely.

> The CLI never enables auth, executes SQL, migrations, or RLS, creates middleware, opens sessions, sends email, or writes application data.

