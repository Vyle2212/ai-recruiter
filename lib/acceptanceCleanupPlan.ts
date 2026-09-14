export type AcceptanceLedgerEntity = {
  entity_type: "auth_user" | "user_profile" | "organization";
  entity_id: string;
};

export function acceptanceCleanupPlan(
  entities: readonly AcceptanceLedgerEntity[],
) {
  const ids = (kind: AcceptanceLedgerEntity["entity_type"]) => [
    ...new Set(
      entities
        .filter((item) => item.entity_type === kind)
        .map((item) => String(item.entity_id || "").trim())
        .filter(Boolean),
    ),
  ];
  return {
    profileIds: ids("user_profile"),
    authUserIds: ids("auth_user"),
    organizationIds: ids("organization"),
  };
}
