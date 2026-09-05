# Secret Rotation Runbook

ContribOS uses several independent credentials. Rotate them independently and never print their values.

## GitHub webhook secret

1. create a new high-entropy webhook secret
2. update the GitHub App webhook configuration
3. update the deployment secret
4. restart or redeploy the control plane
5. verify signed webhook acceptance
6. verify invalid signatures are rejected

Coordinate the update to avoid a period where GitHub and ContribOS use different secrets.

## GitHub OAuth client secret

1. create/rotate the secret in GitHub
2. update the deployment secret
3. redeploy
4. complete a fresh GitHub login
5. verify session creation and repository authorization

Existing user tokens are separate from the OAuth client secret.

## GitHub App private key

1. generate a new GitHub App private key
2. store it in the secret manager
3. update `GITHUB_PRIVATE_KEY`
4. redeploy and verify GitHub installation-token creation
5. remove the old GitHub App key only after successful validation

## Credential encryption key

`CONTRIBOS_CREDENTIAL_ENCRYPTION_KEY` encrypts persisted GitHub user credentials.

Do not rotate it by simply replacing the environment value. Existing ciphertext would become unreadable.

A future key-rotation mechanism must support decrypt-with-old / encrypt-with-new migration or versioned keys.

Until that mechanism exists:

- treat the encryption key as a high-value durable secret
- back it up securely
- restrict access
- do not rotate it casually
- if compromised, revoke affected GitHub credentials and force reauthentication as part of a reviewed recovery procedure
