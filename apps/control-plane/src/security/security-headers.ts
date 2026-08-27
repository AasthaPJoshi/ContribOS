export type SecurityHeaderMap =
  Readonly<Record<string, string>>;

export function securityHeaders():
  SecurityHeaderMap {
  return {
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "permissions-policy":
      "camera=(), microphone=(), geolocation=()"
  };
}
