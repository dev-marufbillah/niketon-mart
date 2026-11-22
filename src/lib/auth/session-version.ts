/** Legacy sessions have no version; changing a password or suspending an admin rotates it. */
export function sameSessionVersion(userVersion: unknown, sessionVersion: unknown): boolean {
  const normalise = (value: unknown): string | null => value == null ? "" : typeof value === "string" ? value : null;
  const current = normalise(userVersion);
  const issued = normalise(sessionVersion);
  return current !== null && issued !== null && current === issued;
}
