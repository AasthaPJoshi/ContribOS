#!/usr/bin/env bash

set -euo pipefail

echo "== Phase 11.1: GitHub installation + repository sync =="

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo
echo "1. Adding repository active-state support..."

python3 <<'PY'
from pathlib import Path

p = Path("packages/db/src/schema.ts")
s = p.read_text()

old = '''    isPrivate: boolean("is_private")
      .notNull()
      .default(false),
    ...timestamps
'''

new = '''    isPrivate: boolean("is_private")
      .notNull()
      .default(false),
    isActive: boolean("is_active")
      .notNull()
      .default(true),
    ...timestamps
'''

if old not in s:
    if 'isActive: boolean("is_active")' not in s:
        raise SystemExit("Could not locate repository isPrivate block.")
else:
    s = s.replace(old, new)

p.write_text(s)
PY

echo
echo "2. Hardening RepositoryRepository..."

python3 <<'PY'
from pathlib import Path

p = Path("packages/db/src/repositories/repository-repository.ts")
s = p.read_text()

if 'import { and, eq, notInArray } from "drizzle-orm";' not in s:
    s = s.replace(
        'import { eq } from "drizzle-orm";',
        'import { and, eq, notInArray } from "drizzle-orm";'
    )

s = s.replace(
'''        isPrivate: input.isPrivate,
        createdAt: now,
''',
'''        isPrivate: input.isPrivate,
        isActive: true,
        createdAt: now,
'''
)

s = s.replace(
'''          isPrivate: input.isPrivate,
          updatedAt: now
''',
'''          isPrivate: input.isPrivate,
          isActive: true,
          updatedAt: now
'''
)

marker = '''  async listByInstallationId(
    installationId: string
  ): Promise<RepositoryRow[]> {
'''

method = '''  async deactivateMissingByInstallationId(
    installationId: string,
    activeGitHubRepositoryIds: string[]
  ): Promise<void> {
    const now = new Date();

    if (activeGitHubRepositoryIds.length === 0) {
      await this.db
        .update(repositories)
        .set({
          isActive: false,
          updatedAt: now
        })
        .where(
          eq(
            repositories.installationId,
            installationId
          )
        );

      return;
    }

    await this.db
      .update(repositories)
      .set({
        isActive: false,
        updatedAt: now
      })
      .where(
        and(
          eq(
            repositories.installationId,
            installationId
          ),
          notInArray(
            repositories.githubRepositoryId,
            activeGitHubRepositoryIds
          )
        )
      );
  }

'''

if method not in s:
    if marker not in s:
        raise SystemExit("Could not locate listByInstallationId.")
    s = s.replace(marker, method + marker)

p.write_text(s)
PY

echo
echo "3. Extending GitHub installation metadata..."

python3 <<'PY'
from pathlib import Path

p = Path("apps/control-plane/src/security/github-user-access-client.ts")
s = p.read_text()

s = s.replace(
'''export interface UserAccessibleInstallation {
  id: number;
  accountLogin: string | null;
}
''',
'''export interface UserAccessibleInstallation {
  id: number;
  accountLogin: string | null;
  accountType: string | null;
  repositorySelection: string | null;
  permissions: Record<string, string>;
}
'''
)

s = s.replace(
'''    account?: {
      login?: string;
    } | null;
''',
'''    account?: {
      login?: string;
      type?: string;
    } | null;
    repository_selection?: string;
    permissions?: Record<string, string>;
'''
)

s = s.replace(
'''          accountLogin:
            installation.account
              ?.login ?? null
        });
''',
'''          accountLogin:
            installation.account
              ?.login ?? null,
          accountType:
            installation.account
              ?.type ?? null,
          repositorySelection:
            installation.repository_selection ??
            null,
          permissions:
            installation.permissions ?? {}
        });
'''
)

p.write_text(s)
PY

echo
echo "4. Extending repository metadata..."

python3 <<'PY'
from pathlib import Path

p = Path("apps/control-plane/src/security/github-user-access-client.ts")
s = p.read_text()

s = s.replace(
'''export interface UserAccessibleRepository {
  id: number;
  fullName: string;
  isPrivate: boolean;
''',
'''export interface UserAccessibleRepository {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string | null;
  isPrivate: boolean;
'''
)

s = s.replace(
'''    full_name?: string;
    private?: boolean;
''',
'''    name?: string;
    full_name?: string;
    default_branch?: string;
    private?: boolean;
    owner?: {
      login?: string;
    } | null;
'''
)

old = '''        result.push({
          id: repository.id,
          fullName:
            repository.full_name,
          isPrivate:
            repository.private ===
            true,
          permissions:
            repository.permissions ??
            {}
        });
'''

new = '''        const owner =
          repository.owner?.login ??
          repository.full_name.split("/")[0];

        const name =
          repository.name ??
          repository.full_name.split("/")[1];

        if (!owner || !name) {
          continue;
        }

        result.push({
          id: repository.id,
          owner,
          name,
          fullName:
            repository.full_name,
          defaultBranch:
            repository.default_branch ??
            null,
          isPrivate:
            repository.private ===
            true,
          permissions:
            repository.permissions ??
            {}
        });
'''

if old in s:
    s = s.replace(old, new)
elif (
    "repository.owner?.login" in s
    and "repository.default_branch" in s
    and "defaultBranch:" in s
):
    print("Repository metadata mapping already applied; skipping.")
else:
    raise SystemExit("Could not locate repository result mapping.")

p.write_text(s)
PY

echo
echo "5. Adding installation sync service..."

cat > apps/control-plane/src/security/github-installation-sync-service.ts <<'TS'
import type {
  InstallationRow,
  RepositoryRow,
  UpsertInstallationInput,
  UpsertRepositoryInput
} from "@contribos/db";

import {
  decryptCredential
} from "./credential-cipher.js";

import type {
  GitHubUserAccessClient
} from "./github-user-access-client.js";

export interface InstallationSyncStore {
  upsert(
    input: UpsertInstallationInput
  ): Promise<InstallationRow>;
}

export interface RepositorySyncStore {
  upsert(
    input: UpsertRepositoryInput
  ): Promise<RepositoryRow>;

  deactivateMissingByInstallationId(
    installationId: string,
    activeGitHubRepositoryIds: string[]
  ): Promise<void>;
}

export interface GitHubInstallationSyncSubject {
  githubAccessTokenCiphertext: string;
  githubAccessTokenExpiresAt: Date | null;
}

export interface GitHubInstallationSyncServiceOptions {
  installations: InstallationSyncStore;
  repositories: RepositorySyncStore;
  github: GitHubUserAccessClient;
  credentialEncryptionKey: string;
}

export interface InstallationSyncResult {
  installationsSynced: number;
  repositoriesSynced: number;
}

export class GitHubInstallationSyncService {
  constructor(
    private readonly options:
      GitHubInstallationSyncServiceOptions
  ) {}

  async sync(
    subject: GitHubInstallationSyncSubject,
    now = new Date()
  ): Promise<InstallationSyncResult> {
    if (
      subject.githubAccessTokenExpiresAt &&
      subject.githubAccessTokenExpiresAt.getTime() <=
        now.getTime()
    ) {
      throw new Error(
        "REAUTHENTICATION_REQUIRED"
      );
    }

    const accessToken =
      decryptCredential(
        subject.githubAccessTokenCiphertext,
        this.options.credentialEncryptionKey
      );

    const githubInstallations =
      await this.options.github
        .listInstallations(accessToken);

    let repositoriesSynced = 0;

    for (
      const githubInstallation of
      githubInstallations
    ) {
      const installation =
        await this.options.installations
          .upsert({
            githubInstallationId:
              String(
                githubInstallation.id
              ),
            accountLogin:
              githubInstallation.accountLogin,
            accountType:
              githubInstallation.accountType,
            permissions:
              githubInstallation.permissions,
            repositorySelection:
              githubInstallation.repositorySelection
          });

      const githubRepositories =
        await this.options.github
          .listRepositories(
            accessToken,
            githubInstallation.id
          );

      const activeIds: string[] = [];

      for (
        const githubRepository of
        githubRepositories
      ) {
        const githubRepositoryId =
          String(githubRepository.id);

        activeIds.push(
          githubRepositoryId
        );

        await this.options.repositories
          .upsert({
            installationId:
              installation.id,
            githubRepositoryId,
            owner:
              githubRepository.owner,
            name:
              githubRepository.name,
            fullName:
              githubRepository.fullName,
            defaultBranch:
              githubRepository.defaultBranch,
            isPrivate:
              githubRepository.isPrivate
          });

        repositoriesSynced += 1;
      }

      await this.options.repositories
        .deactivateMissingByInstallationId(
          installation.id,
          activeIds
        );
    }

    return {
      installationsSynced:
        githubInstallations.length,
      repositoriesSynced
    };
  }
}
TS

echo
echo "6. Exporting sync service..."

if ! grep -q 'github-installation-sync-service' apps/control-plane/src/index.ts 2>/dev/null; then
  if [ -f apps/control-plane/src/index.ts ]; then
    printf '\nexport * from "./security/github-installation-sync-service.js";\n' \
      >> apps/control-plane/src/index.ts
  fi
fi

echo
echo "7. Generating migration..."

pnpm --filter @contribos/db exec drizzle-kit generate

echo
echo "8. Adding sync-service tests..."

cat > apps/control-plane/tests/github-installation-sync-service.test.ts <<'TS'
import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  encryptCredential
} from "../src/security/credential-cipher.js";

import {
  GitHubInstallationSyncService
} from "../src/security/github-installation-sync-service.js";

describe(
  "GitHubInstallationSyncService",
  () => {
    it(
      "upserts installations and repositories",
      async () => {
        const installations = {
          upsert: vi.fn(
            async () => ({
              id: "local-installation"
            })
          )
        };

        const repositories = {
          upsert: vi.fn(
            async () => ({
              id: "local-repository"
            })
          ),
          deactivateMissingByInstallationId:
            vi.fn(async () => {})
        };

        const github = {
          listInstallations:
            vi.fn(async () => [
              {
                id: 10,
                accountLogin: "example",
                accountType: "User",
                repositorySelection:
                  "selected",
                permissions: {
                  contents: "read"
                }
              }
            ]),
          listRepositories:
            vi.fn(async () => [
              {
                id: 20,
                owner: "example",
                name: "repo",
                fullName:
                  "example/repo",
                defaultBranch:
                  "main",
                isPrivate: true,
                permissions: {
                  admin: true
                }
              }
            ])
        };

        const key =
          "0123456789abcdef0123456789abcdef";

        const service =
          new GitHubInstallationSyncService({
            installations:
              installations as never,
            repositories:
              repositories as never,
            github: github as never,
            credentialEncryptionKey: key
          });

        const result =
          await service.sync({
            githubAccessTokenCiphertext:
              encryptCredential(
                "token",
                key
              ),
            githubAccessTokenExpiresAt:
              null
          });

        expect(result).toEqual({
          installationsSynced: 1,
          repositoriesSynced: 1
        });

        expect(
          installations.upsert
        ).toHaveBeenCalledTimes(1);

        expect(
          repositories.upsert
        ).toHaveBeenCalledTimes(1);

        expect(
          repositories
            .deactivateMissingByInstallationId
        ).toHaveBeenCalledWith(
          "local-installation",
          ["20"]
        );
      }
    );

    it(
      "deactivates all repositories when installation has none",
      async () => {
        const installations = {
          upsert: vi.fn(
            async () => ({
              id: "local-installation"
            })
          )
        };

        const repositories = {
          upsert: vi.fn(),
          deactivateMissingByInstallationId:
            vi.fn(async () => {})
        };

        const github = {
          listInstallations:
            vi.fn(async () => [
              {
                id: 10,
                accountLogin: "example",
                accountType: "User",
                repositorySelection:
                  "selected",
                permissions: {}
              }
            ]),
          listRepositories:
            vi.fn(async () => [])
        };

        const key =
          "0123456789abcdef0123456789abcdef";

        const service =
          new GitHubInstallationSyncService({
            installations:
              installations as never,
            repositories:
              repositories as never,
            github: github as never,
            credentialEncryptionKey: key
          });

        await service.sync({
          githubAccessTokenCiphertext:
            encryptCredential(
              "token",
              key
            ),
          githubAccessTokenExpiresAt:
            null
        });

        expect(
          repositories
            .deactivateMissingByInstallationId
        ).toHaveBeenCalledWith(
          "local-installation",
          []
        );
      }
    );
  }
);
TS

echo
echo "9. Running targeted verification..."

pnpm --filter @contribos/db typecheck
pnpm --filter @contribos/db build

pnpm --filter @contribos/control-plane test
pnpm --filter @contribos/control-plane typecheck
pnpm --filter @contribos/control-plane build

echo
echo "=============================================="
echo "Phase 11.1 foundation applied successfully."
echo "=============================================="
echo
echo "Next:"
echo "  1. Inspect generated migration"
echo "  2. Inspect git diff"
echo "  3. Run pnpm verify"
