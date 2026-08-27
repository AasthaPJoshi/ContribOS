export function LoadingState({
  label = "Loading ContribOS data..."
}: {
  label?: string;
}) {
  return (
    <div
      className="state-panel"
      role="status"
    >
      <strong>{label}</strong>
    </div>
  );
}

export function ErrorState({
  title = "Unable to load data",
  message
}: {
  title?: string;
  message: string;
}) {
  return (
    <div
      className="state-panel error"
      role="alert"
    >
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({
  title,
  message
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="state-panel">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
