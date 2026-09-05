# PostgreSQL Backup and Restore Runbook

## Backup policy

Production PostgreSQL must use automated backups appropriate to the hosting platform.

At minimum:

- daily recoverable backups
- retention appropriate to the project
- a backup before risky schema changes
- periodically tested restore procedures

For managed PostgreSQL, prefer provider-native point-in-time recovery where available.

## What the database contains

The database contains operational ContribOS state including:

- installations and repository inventory
- contributions
- normalized evidence
- reconciliation runs
- deterministic state evaluations/history
- webhook delivery lifecycle
- worker jobs
- users, sessions, OAuth state, and encrypted GitHub credentials

The credential encryption key is not stored in PostgreSQL and must be protected separately.

## Restore principle

A database backup is useful only together with the correct application version and the credential encryption key required to decrypt persisted credentials.

## Restore procedure

1. stop application writes
2. identify the target recovery point
3. restore PostgreSQL into an isolated database first when practical
4. verify expected tables and Drizzle migration state
5. configure a compatible ContribOS build against the restored database
6. validate `/live` and `/ready`
7. verify a known repository/contribution query
8. verify GitHub authentication/reconciliation
9. move traffic only after validation

Do not restore production data over a healthy database without an explicit incident decision and rollback plan.
