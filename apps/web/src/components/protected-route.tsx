import type {
  PropsWithChildren
} from "react";

import {
  useAuth
} from "../auth/auth-context.js";
import {
  ErrorState,
  LoadingState
} from "./async-state.js";

export function ProtectedRoute({
  children
}: PropsWithChildren) {
  const auth = useAuth();

  if (
    auth.status === "LOADING"
  ) {
    return (
      <LoadingState
        label="Checking your GitHub session..."
      />
    );
  }

  if (
    auth.status === "ERROR"
  ) {
    return (
      <ErrorState
        title="Authentication unavailable"
        message="ContribOS could not verify your current session."
      />
    );
  }

  if (
    auth.status !==
    "AUTHENTICATED"
  ) {
    return (
      <section
        className="empty-state auth-required"
        aria-labelledby="auth-required-title"
      >
        <p className="eyebrow">
          AUTHENTICATION REQUIRED
        </p>
        <h2 id="auth-required-title">
          Sign in with GitHub
        </h2>
        <p>
          Repository data is protected
          by your GitHub identity and
          installation-aware access.
        </p>
        <button
          type="button"
          onClick={auth.signIn}
        >
          Continue with GitHub
        </button>
      </section>
    );
  }

  return children;
}
