export type FormState = { ok?: boolean; error?: string; message?: string } | null;

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.message) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`rounded-lg px-3 py-2 text-sm ${
        state.error ? "bg-danger-soft text-danger" : "bg-haze text-royal-dark"
      }`}
    >
      {state.error ?? state.message}
    </p>
  );
}
