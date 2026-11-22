import type { Row } from "@/lib/db/types";

/**
 * Exact top-level CAS predicates. Arrays must be compared as arrays (not `$in`),
 * null must not match a missing field, and an absent optional field must remain
 * absent. Nested objects/arrays are the BSON values read from the same document;
 * Mongo compares their full value and field ordering. Integration still requires
 * testing against the actual MongoDB deployment.
 */
export function mongoCompareFilter(id: string, expected: Partial<Row>, validUntil?: { field: string; after: string }) {
  const predicates: Record<string, unknown>[] = [{ id }];
  for (const [key, value] of Object.entries(expected)) {
    if (key === "id") continue;
    if (value === undefined) predicates.push({ [key]: { $exists: false } });
    else if (value === null) predicates.push({ [key]: { $eq: null, $exists: true } });
    else predicates.push({ [key]: { $eq: value } });
  }
  if (validUntil) predicates.push({ [validUntil.field]: { $gt: validUntil.after } });
  return { $and: predicates };
}
