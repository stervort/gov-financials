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

export async function listGroupingLines(engagementId: string, opts?: { page?: number; pageSize?: number; q?: string; ungroupedOnly?: boolean }) {
  const org = await ensureDefaultOrg();
  await db.engagement.findFirstOrThrow({ where: { id: engagementId, organizationId: org.id } });

  const page = Math.max(opts?.page ?? 1, 1);
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 200, 25), 500);
  const skip = (page - 1) * pageSize;

  const imp = await db.trialBalanceImport.findFirst({
    where: { engagementId, status: "IMPORTED" },
    orderBy: { createdAt: "desc" },
  });

  if (!imp) return { page, pageSize, total: 0, lines: [] as any[] };

  const where: any = { importId: imp.id };
  if (opts?.q) {
    where.OR = [
      { account: { contains: opts.q, mode: "insensitive" } },
      { description: { contains: opts.q, mode: "insensitive" } },
      { group: { contains: opts.q, mode: "insensitive" } },
      { subgroup: { contains: opts.q, mode: "insensitive" } },
      { fundCode: { contains: opts.q, mode: "insensitive" } },
    ];
  }
  if (opts?.ungroupedOnly) {
    where.OR = where.OR ?? [];
    where.OR.push({ group: null }, { group: "" }, { subgroup: null }, { subgroup: "" });
  }

  const [funds, total, lines] = await Promise.all([
    db.fund.findMany({ where: { engagementId }, select: { fundCode: true, name: true } }),
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
        group: true,
        subgroup: true,
        amount: true,
        fundCode: true,
      },
    }),
  ]);

  const fundMap = new Map(funds.map(f => [f.fundCode, f.name]));
  const decorated = lines.map(l => ({
    ...l,
    fundLabel: l.fundCode ? `${l.fundCode}${fundMap.get(l.fundCode) ? ` - ${fundMap.get(l.fundCode)}` : ""}` : "",
  }));

  return { page, pageSize, total, lines: decorated };
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
