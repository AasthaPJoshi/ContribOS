export type SecurityHeaderMap =
  Readonly<Record<string, string>>;

export function securityHeaders():
  SecurityHeaderMap {
  return {
    "cache-control": "no-store",
    "content-security-policy":
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "permissions-policy":
      "camera=(), microphone=(), geolocation=()"
  };
}
