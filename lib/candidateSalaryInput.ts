/** Canonical amounts use a dot for decimals; commas are display grouping only. */
export function cleanSalaryInput(value: string) {
  return value.replace(/[,\s]/g, "");
}
export function formatSalaryInput(value: string) {
  const [whole, ...decimals] = value.split(".");
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (decimals.length ? "." + decimals.join(".") : "")
  );
}
