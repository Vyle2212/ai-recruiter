export function searchV2RequestDatasetAllowed(input: {
  nodeEnv: string | undefined;
  enabled: boolean;
  authoritativeRole: string;
}) {
  return (
    input.nodeEnv === "test" &&
    input.enabled &&
    input.authoritativeRole === "admin"
  );
}
