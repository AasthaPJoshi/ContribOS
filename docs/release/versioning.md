# Versioning

ContribOS public releases use semantic versioning:

- MAJOR: incompatible public contract changes
- MINOR: backward-compatible product or API capability
- PATCH: backward-compatible fixes and hardening

The first planned public release is `v0.1.0`.

Before tagging a release:

1. update the repository/package version
2. finalize the matching changelog section
3. run `pnpm verify`
4. run `./scripts/ops/verify-production-readiness.sh`
5. verify the release commit has no local or secret files
6. create an annotated Git tag
7. push the release commit and tag only after review
