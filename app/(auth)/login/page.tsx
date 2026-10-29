import Link from "next/link";
import { LoginForm } from "./login-form";

const ERRORS: Record<string, string> = {
  enlace_invalido: "El enlace no es válido o ya expiró. Pide uno nuevo.",
  sin_organizacion: "Tu usuario no tiene una organización asociada. Contacta al administrador.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Entra a tu panel</h1>
      <p className="mt-2 text-sm text-ink-soft">Revisa conversaciones, citas y la configuración de tu asistente.</p>
      {error && ERRORS[error] && (
        <p role="alert" className="mt-6 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {ERRORS[error]}
        </p>
      )}
      <LoginForm next={next} />
      <p className="mt-8 text-sm text-ink-soft">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/signup" className="font-medium text-royal underline-offset-4 hover:underline">
          Crea una gratis
        </Link>
      </p>
    </>
  );
}
