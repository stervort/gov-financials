"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { redirect } from "next/navigation";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

/**
 * Get the current authenticated user. Redirects to /login if not authenticated.
 * Call this at the top of every server action and server component that needs auth.
 */
export async function requireAuth(): Promise<AuthUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  return {
    id: (session.user as any).id,
    email: session.user.email,
    name: session.user.name ?? null,
  };
}

/**
 * Get the user's organization. Creates a personal org if they don't have one.
 * This is the main tenant boundary — all engagement queries filter by org.
 */
export async function requireOrgForUser() {
  const user = await requireAuth();

  // Find the user's first org membership
  const membership = await db.orgMembership.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });

  if (membership) {
    return { user, org: membership.organization, role: membership.role };
  }

  // First-time user: create a personal organization
  const org = await db.organization.create({
    data: {
      name: `${user.name ?? user.email}'s Firm`,
      memberships: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  return { user, org, role: "OWNER" as const };
}

/**
 * BACKWARD COMPATIBILITY — old code calls ensureDefaultOrg().
 * This now returns the real user's org instead of a hardcoded default.
 * We'll migrate off this gradually, but it keeps everything working.
 */
export async function ensureDefaultOrg() {
  const { org } = await requireOrgForUser();
  return org;
}
