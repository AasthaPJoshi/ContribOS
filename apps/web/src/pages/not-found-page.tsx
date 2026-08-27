import {
  Link
} from "react-router-dom";

export function NotFoundPage() {
  return (
    <section
      className="empty-state route-not-found"
      aria-labelledby="not-found-title"
    >
      <p className="eyebrow">
        NOT FOUND
      </p>
      <h2 id="not-found-title">
        This ContribOS route does not exist.
      </h2>
      <p>
        Return to the repository selector and
        choose a valid ContribOS destination.
      </p>
      <Link
        className="button-link"
        to="/"
      >
        Go home
      </Link>
    </section>
  );
}
