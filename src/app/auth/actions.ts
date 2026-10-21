"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export type AuthFormState = { error: string } | null;

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  // Only allow same-site paths so the form can't be used as an open redirect.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signInWithEmail(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const { error } = await auth.signIn.email({ email, password });
  if (error) return { error: error.message || "That email and password don't match. Try again." };

  redirect(safeNext(formData.get("next")));
}

export async function signUpWithEmail(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || !email) return { error: "Enter your name and email." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };

  const { error } = await auth.signUp.email({ name, email, password });
  if (error) return { error: error.message || "Couldn't create your account. Try again." };

  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  await auth.signOut();
  redirect("/");
}
