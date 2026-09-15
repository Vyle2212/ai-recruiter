import type { SupabaseClient } from "@supabase/supabase-js";

export type StateKind =
  | "copilot_history"
  | "automation_decisions"
  | "automation_rules";
export type StateScope = { organizationId: string | null; profileId: string };
export type StateKey = {
  organization_id: string;
  owner_key: string;
  kind: StateKind;
};
export type StateSnapshot = { revision: number; payload: unknown };
export interface StateRepository {
  read(key: StateKey): Promise<StateSnapshot | null>;
  compareAndSet(
    key: StateKey,
    revision: number | null,
    payload: unknown,
  ): Promise<boolean>;
}
export class RecruiterStateUnavailable extends Error {
  constructor() {
    super("Recruiter storage is unavailable. Please try again later.");
  }
}
export function stateKey(scope: StateScope, kind: StateKind): StateKey {
  if (!scope.organizationId || !scope.profileId)
    throw new RecruiterStateUnavailable();
  return {
    organization_id: scope.organizationId,
    owner_key: kind === "copilot_history" ? scope.profileId : "organization",
    kind,
  };
}
export function supabaseStateRepository(
  client: SupabaseClient,
): StateRepository {
  const scoped = (query: any, key: StateKey) =>
    query
      .eq("organization_id", key.organization_id)
      .eq("owner_key", key.owner_key)
      .eq("kind", key.kind);
  return {
    async read(key) {
      const { data, error } = await scoped(
        client.from("recruiter_runtime_state").select("revision,payload"),
        key,
      ).maybeSingle();
      if (error) throw new RecruiterStateUnavailable();
      return data;
    },
    async compareAndSet(key, revision, payload) {
      if (revision === null) {
        const { error } = await client.from("recruiter_runtime_state").insert({
          ...key,
          owner_profile_id:
            key.kind === "copilot_history" ? key.owner_key : null,
          revision: 1,
          payload,
        });
        if (error?.code === "23505") return false;
        if (error) throw new RecruiterStateUnavailable();
        return true;
      }
      const { data, error } = await scoped(
        client.from("recruiter_runtime_state").update({
          payload,
          revision: revision + 1,
          updated_at: new Date().toISOString(),
        }),
        key,
      )
        .eq("revision", revision)
        .select("revision");
      if (error) throw new RecruiterStateUnavailable();
      return data?.length === 1;
    },
  };
}
export async function readState<T>(
  repository: StateRepository,
  key: StateKey,
  empty: () => T,
): Promise<T> {
  const row = await repository.read(key);
  return row ? (row.payload as T) : empty();
}
export async function mutateState<T, R extends { file: T }>(
  repository: StateRepository,
  key: StateKey,
  empty: () => T,
  apply: (current: T) => R,
): Promise<R> {
  // Revision fencing prevents simultaneous requests overwriting each other's changes.
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await repository.read(key);
    const result = apply(row ? (structuredClone(row.payload) as T) : empty());
    if (await repository.compareAndSet(key, row?.revision ?? null, result.file))
      return result;
  }
  throw new RecruiterStateUnavailable();
}
