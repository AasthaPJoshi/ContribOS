# Release Process

ContribOS uses an explicit release commit followed by an annotated semantic-version tag.

For v0.1.0:

1. finish and review the release-candidate changes
2. ensure all workspace package versions are `0.1.0`
3. finalize the `CHANGELOG.md` release date
4. ensure the Git working tree is clean
5. run:

```sh
./scripts/ops/verify-release.sh 0.1.0
```

6. create the annotated tag only after the release verification passes:

```sh
git tag -a v0.1.0 -m "ContribOS v0.1.0"
```

7. inspect the tag:

```sh
git show --stat v0.1.0
```

8. push the release commit and tag deliberately:

```sh
git push origin <release-branch>
git push origin v0.1.0
```

Pushing the tag triggers `.github/workflows/release.yml`.

The release workflow:

- verifies the tag matches the root package version
- runs the production-readiness gate
- builds the production container as part of that gate
- creates the GitHub Release only after verification passes

A failed release workflow must not be bypassed by creating a GitHub Release manually without understanding the failure.

## Important v0.1 boundary

v0.1.0 remains a single-instance production candidate.

Do not describe the release as multi-replica or horizontally production-ready.
