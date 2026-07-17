export function AdminQueryError({
  title,
  message = 'Unable to load this data right now. Please try again shortly.',
}: {
  title: string;
  message?: string;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-secondary" role="alert">
        {message}
      </p>
    </div>
  );
}

export function firstQueryError(
  results: Array<{ error: { message?: string } | null }>
): string | null {
  for (const result of results) {
    if (result.error) {
      console.error('[admin] query failed:', result.error);
      return result.error.message || 'Query failed';
    }
  }
  return null;
}
