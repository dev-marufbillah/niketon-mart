/** Google sessions cease to work immediately when their link/version changes. */
export function googleSessionMatches(
  profile: { googleSubjectHash?: string | null; googleAuthVersion?: string | null },
  session: { googleSubjectHash?: string; googleAuthVersion?: string },
): boolean {
  if (session.googleSubjectHash === undefined && session.googleAuthVersion === undefined) return true;
  return Boolean(
    session.googleSubjectHash && session.googleAuthVersion &&
    profile.googleSubjectHash === session.googleSubjectHash &&
    profile.googleAuthVersion === session.googleAuthVersion,
  );
}
