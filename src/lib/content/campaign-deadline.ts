/** The homepage campaign editor stores an optional calendar day. A day ends at
 * 23:59:59 Bangladesh time for everyone, not at a visitor's local timezone. An
 * absent or malformed date is never replaced with a fabricated deadline. */
export function campaignDeadline(endsAt: unknown): number | null {
  if (typeof endsAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endsAt) || endsAt.startsWith("0000")) return null;
  const calendar = new Date(`${endsAt}T00:00:00.000Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== endsAt) return null;
  const deadline = Date.parse(`${endsAt}T23:59:59+06:00`);
  return Number.isFinite(deadline) ? deadline : null;
}
