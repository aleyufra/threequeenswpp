import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Crea tu cuenta</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Empiezas con una plantilla de clínica dental que puedes adaptar a tu negocio.
      </p>
      <SignupForm />
      <p className="mt-8 text-sm text-ink-soft">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-royal underline-offset-4 hover:underline">
          Entra aquí
        </Link>
      </p>
    </>
  );
}
