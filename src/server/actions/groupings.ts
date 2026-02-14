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

export async function getGroupingCounts(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  const latest = await getLatestImportedTB(engagementId);
  if (!latest) return { total: 0, grouped: 0, ungrouped: 0 };

  const total = await db.trialBalanceLine.count({ where: { importId: latest.id } });
  const grouped = await db.trialBalanceLine.count({
    where: {
      importId: latest.id,
      OR: [
        { auditGroup: { not: null } },
        { auditSubgroup: { not: null } },
      ],
    },
  });
  const ungrouped = total - grouped;
  return { total, grouped, ungrouped };
}

export async function listGroupingLines(
  engagementId: string,
  opts?: {
    page?: number;
    pageSize?: number;
    q?: string;
    ungroupedOnly?: boolean;
  }
) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  const latest = await getLatestImportedTB(engagementId);
  if (!latest) {
    return {
      importId: null as string | null,
      total: 0,
      page: 1,
      pageSize: 50,
      lines: [] as any[],
      fundsByCode: {} as Record<string, { fundCode: string; name: string | null }>,
    };
  }

  const page = Math.max(1, Math.floor(opts?.page ?? 1));
  const pageSize = Math.min(500, Math.max(25, Math.floor(opts?.pageSize ?? 50)));
  const q = (opts?.q ?? "").trim();
  const ungroupedOnly = !!opts?.ungroupedOnly;

  const where: any = { importId: latest.id };

  if (ungroupedOnly) {
    where.AND = [
      {
        AND: [
          { OR: [{ auditGroup: null }, { auditGroup: "" }] },
          { OR: [{ auditSubgroup: null }, { auditSubgroup: "" }] },
        ],
      },
    ];
  }

  if (q) {
    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          { account: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { auditGroup: { contains: q, mode: "insensitive" } },
          { auditSubgroup: { contains: q, mode: "insensitive" } },
          { fundCode: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const total = await db.trialBalanceLine.count({ where });

  const lines = await db.trialBalanceLine.findMany({
    where,
    orderBy: { account: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const funds = await db.fund.findMany({
    where: { engagementId },
    select: { fundCode: true, name: true },
  });
  const fundsByCode: Record<string, { fundCode: string; name: string | null }> = {};
  for (const f of funds) fundsByCode[f.fundCode] = f;

  return {
    importId: latest.id,
    total,
    page,
    pageSize,
    lines,
    fundsByCode,
  };
}

const BulkUpdate = z.object({
  engagementId: z.string().min(1),
  updates: z.array(
    z.object({
      lineId: z.string().min(1),
      auditGroup: z.string().optional().nullable(),
      auditSubgroup: z.string().optional().nullable(),
    })
  ),
});

export async function updateGroupingsBulk(payload: {
  engagementId: string;
  updates: Array<{ lineId: string; auditGroup?: string | null; auditSubgroup?: string | null }>;
}) {
  const org = await ensureDefaultOrg();
  const v = BulkUpdate.parse(payload);
  await assertEngagement(org.id, v.engagementId);

  // transaction: apply all updates
  await db.$transaction(
    v.updates.map((u) =>
      db.trialBalanceLine.update({
        where: { id: u.lineId },
        data: {
          auditGroup: (u.auditGroup ?? "").trim() || null,
          auditSubgroup: (u.auditSubgroup ?? "").trim() || null,
        },
      })
    )
  );

  revalidatePath(`/dashboard/engagements/${v.engagementId}/groupings`);
  revalidatePath(`/dashboard/engagements/${v.engagementId}`);
}
