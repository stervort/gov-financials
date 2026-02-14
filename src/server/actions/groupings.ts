"use server";

import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { revalidatePath } from "next/cache";

async function assertEngagement(orgId: string, engagementId: string) {
  return db.engagement.findFirstOrThrow({
    where: { id: engagementId, organizationId: orgId },
  });
}

export async function getLatestImportedTB(engagementId: string) {
  return db.trialBalanceImport.findFirst({
    where: { engagementId, status: "IMPORTED" },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGroupingStats(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  const latest = await getLatestImportedTB(engagementId);
  if (!latest) {
    return { importId: null as string | null, grouped: 0, ungrouped: 0, total: 0 };
  }

  const total = await db.trialBalanceLine.count({ where: { importId: latest.id } });
  const ungrouped = await db.trialBalanceLine.count({
    where: {
      importId: latest.id,
      OR: [{ auditGroup: null }, { auditGroup: "" }],
    },
  });
  const grouped = total - ungrouped;

  return { importId: latest.id, grouped, ungrouped, total };
}

export async function listGroupingLines(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  const latest = await getLatestImportedTB(engagementId);
  if (!latest) return { importId: null as string | null, lines: [] as any[] };

  // NOTE: we keep this capped for now so the page stays fast.
  // If you hit the limit on a real client, we'll add paging + server-side filtering.
  const lines = await db.trialBalanceLine.findMany({
    where: { importId: latest.id },
    orderBy: { account: "asc" },
    take: 2000,
  });

  return { importId: latest.id, lines };
}

export async function updateLineGrouping(formData: FormData) {
  const org = await ensureDefaultOrg();
  const engagementId = String(formData.get("engagementId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  if (!engagementId || !lineId) return;

  await assertEngagement(org.id, engagementId);

  const auditGroup = String(formData.get("auditGroup") ?? "").trim();
  const auditSubgroup = String(formData.get("auditSubgroup") ?? "").trim();

  await db.trialBalanceLine.update({
    where: { id: lineId },
    data: {
      auditGroup: auditGroup || null,
      auditSubgroup: auditSubgroup || null,
    },
  });

  revalidatePath(`/dashboard/engagements/${engagementId}/groupings`);
  revalidatePath(`/dashboard/engagements/${engagementId}`);
}
