import {
  FormEvent,
  useState
} from "react";
import {
  useNavigate
} from "react-router-dom";

export function HomePage() {
  const navigate = useNavigate();
  const [repositoryId, setRepositoryId] =
    useState("");

  function submit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalized =
      repositoryId.trim();

    if (!/^[1-9]\d*$/.test(normalized)) {
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
          Know what needs attention next.
        </h2>
        <p className="lede">
          ContribOS turns GitHub evidence
          into deterministic workflow state,
          ownership, readiness, and an
          auditable contribution trail.
        </p>
      </div>

      <form
        className="repository-form"
        onSubmit={submit}
      >
        <label htmlFor="repository-id">
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
      </form>
    </section>
  );
}
