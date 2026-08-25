import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGitHubWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  webhookSecret: string
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expectedSignature =
    "sha256=" +
    createHmac("sha256", webhookSecret)
      .update(rawBody, "utf8")
      .digest("hex");

  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signatureHeader);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}
