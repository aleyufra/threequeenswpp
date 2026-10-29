"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/session";
import type { FormState } from "@/components/form-message";

const callbackUrl = () => `${process.env.NEXT_PUBLIC_APP_URL}/callback?next=/dashboard`;

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: field(formData, "email"),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: "Correo o contraseña incorrectos." };
  redirect(safeNextPath(formData.get("next")));
}

export async function sendMagicLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email");
  if (!email) return { error: "Escribe tu correo." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(), shouldCreateUser: false },
  });
  if (error) return { error: "No pudimos enviar el enlace. Revisa el correo e inténtalo de nuevo." };
  return { ok: true, message: `Enviamos un enlace de acceso a ${email}.` };
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const businessName = field(formData, "business_name");
  const fullName = field(formData, "full_name");
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");

  if (!businessName) return { error: "Escribe el nombre de tu negocio." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const supabase = await createClient();
  // El trigger on_auth_user_created crea la organización, el perfil y la configuración del agente.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { business_name: businessName, full_name: fullName },
      emailRedirectTo: callbackUrl(),
    },
  });
  if (error) return { error: error.message };
  if (data.session) redirect("/dashboard");
  return { ok: true, message: `Te enviamos un correo a ${email} para confirmar la cuenta.` };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
