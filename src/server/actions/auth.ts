"use server";

import { db } from "@/src/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const RegisterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterResult = {
  ok: boolean;
  error?: string;
};

export async function registerUser(formData: FormData): Promise<RegisterResult> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { name, email, password } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  // Check if user already exists
  const existing = await db.user.findUnique({ where: { email: emailLower } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists" };
  }

  // Hash password and create user
  const hashedPassword = await bcrypt.hash(password, 12);

  await db.user.create({
    data: {
      name: name.trim(),
      email: emailLower,
      hashedPassword,
    },
  });

  return { ok: true };
}
