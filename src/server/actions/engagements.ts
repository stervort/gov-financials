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
      fundRules: { createMany: { data: [
        { name: "Fund = first 2 digits (most formats)", accountRegex: "^(\\d{2}).*$", captureGroup: 1, enabled: false },
        { name: "Fund = first 2 digits before dash/dot", accountRegex: "^(\\d{2})[-\\.].*$", captureGroup: 1, enabled: true },
        { name: "Fund = first 2 digits in 10-50-4000", accountRegex: "^(\\d{2})-\\d{2}-\\d{4}.*$", captureGroup: 1, enabled: false }
      ]}}
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

export async function deleteEngagement(formData: FormData) {
  const org = await ensureDefaultOrg();
  const engagementId = String(formData.get("engagementId") ?? "");

  if (!engagementId) return;

  // verify it belongs to our org
  await db.engagement.findFirstOrThrow({
    where: { id: engagementId, organizationId: org.id },
  });

  // delete children first to avoid FK errors
  await db.$transaction(async (tx) => {
    const imports = await tx.trialBalanceImport.findMany({
      where: { engagementId },
      select: { id: true },
    });
    const importIds = imports.map((x) => x.id);

    if (importIds.length) {
      await tx.trialBalanceLine.deleteMany({ where: { importId: { in: importIds } } });
      await tx.trialBalanceImport.deleteMany({ where: { id: { in: importIds } } });
    }

    await tx.fund.deleteMany({ where: { engagementId } });
    await tx.fundDetectionRule.deleteMany({ where: { engagementId } });
    await tx.engagement.delete({ where: { id: engagementId } });
  });
}
