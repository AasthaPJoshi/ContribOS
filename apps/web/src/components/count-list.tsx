import type {
  CountEntry
} from "../product/dashboard-view-model.js";

export function CountList({
  title,
  entries
}: {
  title: string;
  entries: CountEntry[];
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>{title}</h3>
      </div>

      {entries.length === 0 ? (
        <p className="muted">
          No recorded values.
        </p>
      ) : (
        <ul className="count-list">
          {entries.map((entry) => (
            <li key={entry.label}>
              <span>{entry.label}</span>
              <strong>{entry.value}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
