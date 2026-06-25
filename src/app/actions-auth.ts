"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { creerJeton, COOKIE_SESSION } from "@/lib/auth";

export async function connexion(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?error=1");
  }

  const token = await creerJeton({ sub: user.id, email: user.email });
  (await cookies()).set(COOKIE_SESSION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 jours
    path: "/",
  });

  redirect("/");
}

export async function deconnexion() {
  (await cookies()).delete(COOKIE_SESSION);
  redirect("/login");
}
