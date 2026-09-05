# Database Migration Runbook

## Current behavior

The control plane runs Drizzle migrations during startup before it begins listening for traffic.

Startup fails if:

- the migration directory is unavailable
- the Drizzle migration journal is unavailable
- a migration fails

The service must never report ready after a failed migration.

## Single-instance v0.1 deployment

For one production control-plane instance, startup migration execution is the supported v0.1 path.

## Multiple replicas

Do not scale startup migration ownership to multiple simultaneous replicas without a reviewed coordination strategy.

Before multi-replica production deployment, choose one of:

- a dedicated migration job before application rollout
- deployment-platform serialization
- an explicit PostgreSQL advisory-lock migration wrapper

Only one actor should own schema migration execution for a release.

## Migration review checklist

Before rollout:

1. inspect generated SQL
2. confirm additions/defaults/nullability
3. identify table-lock or rewrite risk
4. confirm old/new application compatibility
5. take or verify a recent PostgreSQL backup
6. run `pnpm verify`
7. test migration against a production-like database

Never edit an already-applied migration in place.

Create a new forward migration instead.

## Failure response

If startup migration fails:

1. keep the new version out of traffic
2. capture the migration error without leaking credentials
3. inspect PostgreSQL state and the Drizzle journal
4. determine whether the failed statement committed
5. fix forward with a reviewed migration or restore from backup when required
6. redeploy only after verifying the recovery path
