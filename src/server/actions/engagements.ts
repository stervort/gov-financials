"use server";
import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { z } from "zod";

const Create = z.object({ name: z.string().min(2), fiscalYearEnd: z.string().min(8) });

export async function createEngagement(formData: FormData) {
  const org = await ensureDefaultOrg();
  const v = Create.parse({ name: formData.get("name"), fiscalYearEnd: formData.get("fiscalYearEnd") });

  await db.engagement.create({
    data: {
      organizationId: org.id,
      name: v.name,
      fiscalYearEnd: new Date(v.fiscalYearEnd),
      fundRules: { create: { accountRegex: "^(\\d{2})-\\d{4}$", captureGroup: 1 } }
    }
  });
}

export async function listEngagements() {
  const org = await ensureDefaultOrg();
  return db.engagement.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" } });
}

export async function getEngagement(id: string) {
  const org = await ensureDefaultOrg();
  return db.engagement.findFirstOrThrow({ where: { id, organizationId: org.id } });
}
