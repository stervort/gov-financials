"use server";

import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
    where: { importId: latest.id, OR: [{ auditGroup: null }, { auditGroup: "" }] },
  });

  return { importId: latest.id, grouped: total - ungrouped, ungrouped, total };
}

export async function listGroupingLines(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  const latest = await getLatestImportedTB(engagementId);
  if (!latest) return { importId: null as string | null, lines: [] as any[], totalLines: 0 };

  // Quick fix: bump cap to 10,000
  const TAKE = 10000;

  const [totalLines, lines] = await Promise.all([
    db.trialBalanceLine.count({ where: { importId: latest.id } }),
    db.trialBalanceLine.findMany({
      where: { importId: latest.id },
      orderBy: { account: "asc" },
      take: TAKE,
    }),
  ]);

  return { importId: latest.id, lines, totalLines };
}

const BulkEdit = z.object({
  engagementId: z.string().min(1),
  editsJson: z.string().min(2),
});

const EditItem = z.object({
  lineId: z.string().min(1),
  auditGroup: z.string().optional().nullable(),
  auditSubgroup: z.string().optional().nullable(),
});

export async function bulkUpdateGroupings(formData: FormData) {
  const org = await ensureDefaultOrg();

  const v = BulkEdit.parse({
    engagementId: String(formData.get("engagementId") ?? ""),
    editsJson: String(formData.get("editsJson") ?? ""),
  });

  await assertEngagement(org.id, v.engagementId);

  let parsed: unknown;
  try {
    parsed = JSON.parse(v.editsJson);
  } catch {
    throw new Error("Could not parse edits JSON.");
  }

  const edits = z.array(EditItem).parse(parsed);

  // nothing to do
  if (edits.length === 0) return;

  await db.$transaction(async (tx) => {
    for (const e of edits) {
      const auditGroup = (e.auditGroup ?? "").trim();
      const auditSubgroup = (e.auditSubgroup ?? "").trim();

      await tx.trialBalanceLine.update({
        where: { id: e.lineId },
        data: {
          auditGroup: auditGroup || null,
          auditSubgroup: auditSubgroup || null,
        },
      });
    }
  });

  revalidatePath(`/dashboard/engagements/${v.engagementId}/groupings`);
  revalidatePath(`/dashboard/engagements/${v.engagementId}`);
}
