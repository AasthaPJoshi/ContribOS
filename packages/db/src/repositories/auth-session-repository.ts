import {
  and,
  eq,
  gt,
  isNull,
  lt
} from "drizzle-orm";
import {
  randomUUID
} from "node:crypto";

import type {
  ContribOSDatabase
} from "../database.js";
import {
  authSessions,
  authUsers
} from "../schema.js";

export type AuthSessionRow =
  typeof authSessions.$inferSelect;

export interface ActiveAuthSession {
  session: AuthSessionRow;
  user: typeof authUsers.$inferSelect;
}

export interface CreateAuthSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export class AuthSessionRepository {
  constructor(
    private readonly db:
      ContribOSDatabase
  ) {}

  async create(
    input: CreateAuthSessionInput
  ): Promise<AuthSessionRow> {
    const rows = await this.db
      .insert(authSessions)
      .values({
        id: randomUUID(),
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt
      })
      .returning();

    const session = rows[0];

    if (!session) {
      throw new Error(
        "AUTH_SESSION_CREATE_FAILED"
      );
    }

    return session;
  }

  async findActiveByTokenHash(
    tokenHash: string,
    now = new Date()
  ): Promise<ActiveAuthSession | null> {
    const rows = await this.db
      .select({
        session: authSessions,
        user: authUsers
      })
      .from(authSessions)
      .innerJoin(
        authUsers,
        eq(
          authSessions.userId,
          authUsers.id
        )
      )
      .where(
        and(
          eq(
            authSessions.tokenHash,
            tokenHash
          ),
          isNull(
            authSessions.revokedAt
          ),
          gt(
            authSessions.expiresAt,
            now
          )
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async revokeByTokenHash(
    tokenHash: string,
    now = new Date()
  ): Promise<boolean> {
    const rows = await this.db
      .update(authSessions)
      .set({
        revokedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(
            authSessions.tokenHash,
            tokenHash
          ),
          isNull(
            authSessions.revokedAt
          )
        )
      )
      .returning({
        id: authSessions.id
      });

    return rows.length > 0;
  }

  async touch(
    id: string,
    now = new Date()
  ): Promise<void> {
    await this.db
      .update(authSessions)
      .set({
        lastSeenAt: now,
        updatedAt: now
      })
      .where(
        eq(authSessions.id, id)
      );
  }

  async deleteExpired(
    now = new Date()
  ): Promise<number> {
    const rows = await this.db
      .delete(authSessions)
      .where(
        lt(
          authSessions.expiresAt,
          now
        )
      )
      .returning({
        id: authSessions.id
      });

    return rows.length;
  }
}
