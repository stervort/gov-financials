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
      OR: [{ auditGroup: { not: null } }, { auditSubgroup: { not: null } }],
    },
  });

  const ungrouped = total - grouped;
  return { total, grouped, ungrouped };
}

export async function listGroupingLines(
  engagementId: string,
  opts?: { page?: number; pageSize?: number; q?: string; ungroupedOnly?: boolean }
) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  const page = Math.max(opts?.page ?? 1, 1);
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 50, 25), 500);
  const skip = (page - 1) * pageSize;

  const imp = await db.trialBalanceImport.findFirst({
    where: { engagementId, status: "IMPORTED" },
    orderBy: { createdAt: "desc" },
  });

  if (!imp) {
    return {
      importId: null as string | null,
      fundsByCode: {} as Record<string, { fundCode: string; name: string | null }>,
      page,
      pageSize,
      total: 0,
      lines: [] as any[],
    };
  }

  // funds map for "10 - General Fund" display
  const funds = await db.fund.findMany({
    where: { engagementId },
    select: { fundCode: true, name: true },
    orderBy: { fundCode: "asc" },
  });

  const fundsByCode: Record<string, { fundCode: string; name: string | null }> = {};
  for (const f of funds) fundsByCode[f.fundCode] = { fundCode: f.fundCode, name: f.name ?? null };

  // Filtering/search
  const where: any = { importId: imp.id };

  const q = (opts?.q ?? "").trim();
  if (q) {
    where.OR = [
      { account: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { auditGroup: { contains: q, mode: "insensitive" } },
      { auditSubgroup: { contains: q, mode: "insensitive" } },
      { fundCode: { contains: q, mode: "insensitive" } },
    ];
  }

  if (opts?.ungroupedOnly) {
    // only show lines where BOTH audit group/subgroup are blank
    where.AND = [
      {
        OR: [{ auditGroup: null }, { auditGroup: "" }],
      },
      {
        OR: [{ auditSubgroup: null }, { auditSubgroup: "" }],
      },
    ];
  }

  const [total, lines] = await Promise.all([
    db.trialBalanceLine.count({ where }),
    db.trialBalanceLine.findMany({
      where,
      orderBy: [{ account: "asc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        account: true,
        description: true,
        finalBalance: true,
        auditGroup: true,
        auditSubgroup: true,
        fundCode: true,
      },
    }),
  ]);

  return {
    importId: imp.id,
    fundsByCode,
    page,
    pageSize,
    total,
    lines,
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
