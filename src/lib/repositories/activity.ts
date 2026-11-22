import "server-only";

import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";

/**
 * Admin activity log.
 * Every mutating server action writes one row so there is an auditable trail of
 * who changed what, when — required for a multi-user admin panel.
 */

export type ActivityRow = Row & {
  actorId?: string;
  actor: string;
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
  createdAt: string;
};

export async function logActivity(input: {
  actor: { id?: string; name: string } | string;
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
}): Promise<void> {
  try {
    const db = await ensureDatabase();
    const actor = typeof input.actor === "string" ? { id: undefined, name: input.actor } : input.actor;
    await db.insert<ActivityRow>("activity", {
      actorId: actor.id,
      actor: actor.name,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      summary: input.summary,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Driver errors may contain connection strings; never log credentials.
    console.error("[activity] failed to write log entry");
  }
}

export async function listActivity(limit = 100): Promise<ActivityRow[]> {
  const db = await ensureDatabase();
  const rows = await db.list<ActivityRow>("activity");
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
}
