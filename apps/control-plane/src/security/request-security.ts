export type ProductRouteSecurity =
  | {
      kind: "PUBLIC";
    }
  | {
      kind: "GITHUB_WEBHOOK";
    }
  | {
      kind: "AUTHENTICATED_PRODUCT_API";
    };

export function classifyRequestSecurity(
  pathname: string
): ProductRouteSecurity {
  if (
    pathname === "/live" ||
    pathname === "/ready"
  ) {
    return {
      kind: "PUBLIC"
    };
  }

  if (pathname === "/webhooks/github") {
    return {
      kind: "GITHUB_WEBHOOK"
    };
  }

  if (
    pathname === "/api" ||
    pathname.startsWith("/api/")
  ) {
    return {
      kind: "AUTHENTICATED_PRODUCT_API"
    };
  }

  return {
    kind: "PUBLIC"
  };
}
