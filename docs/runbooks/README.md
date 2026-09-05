# ContribOS Operations Runbooks

These runbooks describe the v0.1 production operating model for the ContribOS control plane.

Runbooks:

- `production-deployment.md` - deploy, validate, rollback, and shutdown behavior
- `database-migrations.md` - migration ownership and safety
- `secret-rotation.md` - GitHub App, OAuth, webhook, and encryption-key handling
- `incident-response.md` - first-response workflow for service and dependency failures
- `backup-restore.md` - PostgreSQL backup and restore expectations

The deterministic GitHub evidence model remains canonical. Operational automation must not invent contribution state, ownership, or readiness.
