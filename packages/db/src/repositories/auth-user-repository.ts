import {
  and,
  eq
} from "drizzle-orm";
import {
  randomUUID
} from "node:crypto";

import type {
  ContribOSDatabase
} from "../database.js";
import {
  authUsers
} from "../schema.js";

export type AuthUserRow =
  typeof authUsers.$inferSelect;

export interface UpsertGitHubUserInput {
  providerUserId: string;
  login: string;
  avatarUrl: string | null;
  githubAccessTokenCiphertext: string;
  githubAccessTokenExpiresAt:
    Date | null;
  githubRefreshTokenCiphertext:
    string | null;
  githubRefreshTokenExpiresAt:
    Date | null;
}

export class AuthUserRepository {
  constructor(
    private readonly db:
      ContribOSDatabase
  ) {}

  async upsertGitHubUser(
    input: UpsertGitHubUserInput
  ): Promise<AuthUserRow> {
    const now = new Date();

    const rows = await this.db
      .insert(authUsers)
      .values({
        id: randomUUID(),
        provider: "GITHUB",
        providerUserId:
          input.providerUserId,
        login: input.login,
        avatarUrl: input.avatarUrl,
        githubAccessTokenCiphertext:
          input.githubAccessTokenCiphertext,
        githubAccessTokenExpiresAt:
          input.githubAccessTokenExpiresAt,
        githubRefreshTokenCiphertext:
          input.githubRefreshTokenCiphertext,
        githubRefreshTokenExpiresAt:
          input.githubRefreshTokenExpiresAt,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [
          authUsers.provider,
          authUsers.providerUserId
        ],
        set: {
          login: input.login,
          avatarUrl: input.avatarUrl,
          githubAccessTokenCiphertext:
            input.githubAccessTokenCiphertext,
          githubAccessTokenExpiresAt:
            input.githubAccessTokenExpiresAt,
          githubRefreshTokenCiphertext:
            input.githubRefreshTokenCiphertext,
          githubRefreshTokenExpiresAt:
            input.githubRefreshTokenExpiresAt,
          updatedAt: now
        }
      })
      .returning();

    const user = rows[0];

    if (!user) {
      throw new Error(
        "AUTH_USER_UPSERT_FAILED"
      );
    }

    return user;
  }

  async findById(
    id: string
  ): Promise<AuthUserRow | null> {
    const rows = await this.db
      .select()
      .from(authUsers)
      .where(eq(authUsers.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async findGitHubUser(
    providerUserId: string
  ): Promise<AuthUserRow | null> {
    const rows = await this.db
      .select()
      .from(authUsers)
      .where(
        and(
          eq(
            authUsers.provider,
            "GITHUB"
          ),
          eq(
            authUsers.providerUserId,
            providerUserId
          )
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }
}
