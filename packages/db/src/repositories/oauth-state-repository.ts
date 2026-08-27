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
  oauthStates
} from "../schema.js";

export type OAuthStateRow =
  typeof oauthStates.$inferSelect;

export interface CreateOAuthStateInput {
  stateHash: string;
  expiresAt: Date;
}

export class OAuthStateRepository {
  constructor(
    private readonly db:
      ContribOSDatabase
  ) {}

  async create(
    input: CreateOAuthStateInput
  ): Promise<OAuthStateRow> {
    const rows = await this.db
      .insert(oauthStates)
      .values({
        id: randomUUID(),
        stateHash: input.stateHash,
        expiresAt: input.expiresAt
      })
      .returning();

    const state = rows[0];

    if (!state) {
      throw new Error(
        "OAUTH_STATE_CREATE_FAILED"
      );
    }

    return state;
  }

  async consume(
    stateHash: string,
    now = new Date()
  ): Promise<OAuthStateRow | null> {
    const rows = await this.db
      .update(oauthStates)
      .set({
        consumedAt: now
      })
      .where(
        and(
          eq(
            oauthStates.stateHash,
            stateHash
          ),
          isNull(
            oauthStates.consumedAt
          ),
          gt(
            oauthStates.expiresAt,
            now
          )
        )
      )
      .returning();

    return rows[0] ?? null;
  }

  async deleteExpired(
    now = new Date()
  ): Promise<number> {
    const rows = await this.db
      .delete(oauthStates)
      .where(
        lt(
          oauthStates.expiresAt,
          now
        )
      )
      .returning({
        id: oauthStates.id
      });

    return rows.length;
  }
}
