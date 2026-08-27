import {
  FormEvent,
  useState
} from "react";
import {
  useNavigate
} from "react-router-dom";

import {
  useAuth
} from "../auth/auth-context.js";

export function HomePage() {
  const navigate =
    useNavigate();
  const auth =
    useAuth();

  const [
    repositoryId,
    setRepositoryId
  ] = useState("");

  function submit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalized =
      repositoryId.trim();

    if (
      !/^[1-9]\d*$/.test(
        normalized
      )
    ) {
      return;
    }

    navigate(
      `/repositories/${normalized}`
    );
  }

  return (
    <section className="hero">
      <div>
        <p className="eyebrow">
          MAINTAINER CONTROL PLANE
        </p>
        <h2>
          Know what needs
          attention next.
        </h2>
        <p className="lede">
          ContribOS turns GitHub
          evidence into deterministic
          workflow state, ownership,
          readiness, and an auditable
          contribution trail.
        </p>
      </div>

      {auth.status ===
      "AUTHENTICATED" ? (
        <form
          className="repository-form"
          onSubmit={submit}
        >
          <label
            htmlFor="repository-id"
          >
            GitHub repository ID
          </label>
          <div className="input-row">
            <input
              id="repository-id"
              inputMode="numeric"
              placeholder="123456789"
              value={repositoryId}
              onChange={(event) =>
                setRepositoryId(
                  event.target.value
                )
              }
            />
            <button type="submit">
              Open repository
            </button>
          </div>
          <p className="form-hint">
            ContribOS independently
            verifies that your GitHub
            identity can access this
            repository through the
            installed GitHub App.
          </p>
        </form>
      ) : auth.status ===
        "ANONYMOUS" ? (
        <section className="sign-in-panel">
          <div>
            <strong>
              GitHub authentication
              required
            </strong>
            <p>
              Sign in before opening
              repository data.
            </p>
          </div>
          <button
            type="button"
            onClick={auth.signIn}
          >
            Continue with GitHub
          </button>
        </section>
      ) : null}
    </section>
  );
}
