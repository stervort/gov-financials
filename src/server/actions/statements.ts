"use server";

import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type StatementType =
  | "GOV_FUNDS_BALANCE_SHEET"
  | "GOV_FUNDS_REVENUES_EXPENDITURES_CHANGES";

async function assertEngagement(orgId: string, engagementId: string) {
  return db.engagement.findFirstOrThrow({ where: { id: engagementId, organizationId: orgId } });
}

export async function ensureDefaultGovernmentalTemplates(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  const existing = await db.statementTemplate.findFirst({
    where: { engagementId, type: "GOV_FUNDS_BALANCE_SHEET" },
    select: { id: true },
  });
  if (existing) return;

  await db.$transaction(async (tx) => {
    const bs = await tx.statementTemplate.create({
      data: {
        engagementId,
        type: "GOV_FUNDS_BALANCE_SHEET",
        name: "Governmental Funds Balance Sheet (Default)",
        lineItems: {
          create: [
            { order: 10, code: "CASH", label: "Cash and cash equivalents", category: "ASSET" },
            { order: 20, code: "INVEST", label: "Investments", category: "ASSET" },
            { order: 30, code: "REC", label: "Receivables", category: "ASSET" },
            { order: 40, code: "DUEFROM", label: "Due from other funds", category: "ASSET" },
            { order: 50, code: "PREPAID", label: "Prepaids", category: "ASSET" },
            { order: 60, code: "OTHERASSET", label: "Other assets", category: "ASSET" },

            { order: 110, code: "AP", label: "Accounts payable", category: "LIABILITY" },
            { order: 120, code: "ACCRUED", label: "Accrued liabilities", category: "LIABILITY" },
            { order: 130, code: "DUE2", label: "Due to other funds", category: "LIABILITY" },
            { order: 140, code: "DEFERREDIN", label: "Deferred inflows of resources", category: "LIABILITY" },
            { order: 150, code: "OTHERLIAB", label: "Other liabilities", category: "LIABILITY" },

            { order: 210, code: "FUND_BAL", label: "Fund balance", category: "EQUITY" },
          ],
        },
      },
    });

    await tx.statementTemplate.create({
      data: {
        engagementId,
        type: "GOV_FUNDS_REVENUES_EXPENDITURES_CHANGES",
        name: "Statement of Revenues, Expenditures, and Changes in Fund Balances (Default)",
        lineItems: {
          create: [
            { order: 10, code: "TAX", label: "Taxes", category: "REVENUE" },
            { order: 20, code: "INTERGOV", label: "Intergovernmental", category: "REVENUE" },
            { order: 30, code: "CHARGES", label: "Charges for services", category: "REVENUE" },
            { order: 40, code: "FINE", label: "Fines and forfeitures", category: "REVENUE" },
            { order: 50, code: "INVREV", label: "Investment earnings", category: "REVENUE" },
            { order: 60, code: "OTHERREV", label: "Other revenues", category: "REVENUE" },

            { order: 110, code: "GEN", label: "General government", category: "EXPENSE" },
            { order: 120, code: "PUBLICSAF", label: "Public safety", category: "EXPENSE" },
            { order: 130, code: "PUBLICWRK", label: "Public works", category: "EXPENSE" },
            { order: 140, code: "HEALTH", label: "Health and welfare", category: "EXPENSE" },
            { order: 150, code: "DEBTSVC", label: "Debt service", category: "EXPENSE" },
            { order: 160, code: "CAPITAL", label: "Capital outlay", category: "EXPENSE" },
            { order: 170, code: "OTHEREXP", label: "Other expenditures", category: "EXPENSE" },

            { order: 210, code: "TRANS", label: "Other financing sources/uses", category: "OTHER" },
          ],
        },
      },
    });

    // silence TS unused
    void bs;
  });
}

export async function getLatestImportedTBForStatements(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);
  return db.trialBalanceImport.findFirst({
    where: { engagementId, status: "IMPORTED" },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGovernmentalStatementOverview(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  await ensureDefaultGovernmentalTemplates(engagementId);
  const imp = await getLatestImportedTBForStatements(engagementId);

  const [templates, funds] = await Promise.all([
    db.statementTemplate.findMany({
      where: { engagementId, type: { in: ["GOV_FUNDS_BALANCE_SHEET", "GOV_FUNDS_REVENUES_EXPENDITURES_CHANGES"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, name: true },
    }),
    db.fund.findMany({ where: { engagementId }, orderBy: { fundCode: "asc" }, select: { fundCode: true, name: true } }),
  ]);

  return {
    importId: imp?.id ?? null,
    templates,
    funds,
  };
}

export async function getGovernmentalBalanceSheetMatrix(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);
  await ensureDefaultGovernmentalTemplates(engagementId);

  const imp = await getLatestImportedTBForStatements(engagementId);
  if (!imp) {
    return { importId: null as string | null, funds: [], template: null as any, lineItems: [], matrix: [] as any[], unassignedCount: 0 };
  }

  const template = await db.statementTemplate.findFirstOrThrow({
    where: { engagementId, type: "GOV_FUNDS_BALANCE_SHEET" },
    select: { id: true, name: true, type: true },
  });

  const [lineItems, funds] = await Promise.all([
    db.statementLineItem.findMany({
      where: { templateId: template.id },
      orderBy: { order: "asc" },
      select: { id: true, code: true, label: true, category: true, order: true },
    }),
    db.fund.findMany({ where: { engagementId }, orderBy: { fundCode: "asc" }, select: { fundCode: true, name: true } }),
  ]);

  // sums per (lineItem, fund)
  const assigned = await db.statementLineAssignment.findMany({
    where: { engagementId, importId: imp.id },
    select: { lineItemId: true, tbLineId: true, fundCode: true },
  });

  const tbLines = await db.trialBalanceLine.findMany({
    where: { importId: imp.id },
    select: { id: true, fundCode: true, finalBalance: true },
  });

  const balanceByTbLineId = new Map<string, number>();
  for (const l of tbLines) balanceByTbLineId.set(l.id, Number(l.finalBalance));

  const sums = new Map<string, number>();
  for (const a of assigned) {
    const fundCode = a.fundCode ?? "";
    const key = `${a.lineItemId}::${fundCode}`;
    sums.set(key, (sums.get(key) ?? 0) + (balanceByTbLineId.get(a.tbLineId) ?? 0));
  }

  const assignedTbLineIds = new Set(assigned.map((a) => a.tbLineId));
  const unassignedCount = tbLines.filter((l) => !!l.fundCode).filter((l) => !assignedTbLineIds.has(l.id)).length;

  // matrix: rows = lineItems, cols = funds
  const matrix = lineItems.map((li) => {
    const row: Record<string, any> = { lineItemId: li.id, code: li.code, label: li.label, category: li.category };
    for (const f of funds) {
      const key = `${li.id}::${f.fundCode}`;
      row[f.fundCode] = sums.get(key) ?? 0;
    }
    row.total = funds.reduce((acc, f) => acc + (row[f.fundCode] ?? 0), 0);
    return row;
  });

  return { importId: imp.id, funds, template, lineItems, matrix, unassignedCount };
}

export async function getFundTBForAssignment(engagementId: string, importId: string, fundCode: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  const lines = await db.trialBalanceLine.findMany({
    where: { importId, fundCode },
    orderBy: { account: "asc" },
    select: { id: true, account: true, description: true, finalBalance: true },
  });

  const assigned = await db.statementLineAssignment.findMany({
    where: { engagementId, importId, fundCode },
    select: { tbLineId: true, lineItemId: true },
  });

  const assignedByTbLineId: Record<string, string> = {};
  for (const a of assigned) assignedByTbLineId[a.tbLineId] = a.lineItemId;

  return {
    lines: lines.map((l) => ({ ...l, finalBalance: Number(l.finalBalance), assignedLineItemId: assignedByTbLineId[l.id] ?? null })),
  };
}

const SetAssignments = z.object({
  engagementId: z.string().min(1),
  importId: z.string().min(1),
  fundCode: z.string().min(1),
  lineItemId: z.string().min(1),
  checkedTbLineIds: z.array(z.string().min(1)),
});

export async function setLineItemAssignments(payload: {
  engagementId: string;
  importId: string;
  fundCode: string;
  lineItemId: string;
  checkedTbLineIds: string[];
}) {
  const org = await ensureDefaultOrg();
  const v = SetAssignments.parse(payload);
  await assertEngagement(org.id, v.engagementId);

  // All TB lines for this fund (in this import)
  const fundLines = await db.trialBalanceLine.findMany({
    where: { importId: v.importId, fundCode: v.fundCode },
    select: { id: true },
  });
  const fundLineIds = fundLines.map((x) => x.id);

  const checked = new Set(v.checkedTbLineIds);
  const toRemove = fundLineIds.filter((id) => !checked.has(id));

  await db.$transaction(async (tx) => {
    // remove assignments on this line item for unchecked rows
    if (toRemove.length) {
      await tx.statementLineAssignment.deleteMany({
        where: {
          engagementId: v.engagementId,
          importId: v.importId,
          fundCode: v.fundCode,
          lineItemId: v.lineItemId,
          tbLineId: { in: toRemove },
        },
      });
    }

    // upsert checked assignments, removing any prior assignment for those tb lines
    for (const tbLineId of v.checkedTbLineIds) {
      await tx.statementLineAssignment.deleteMany({
        where: { engagementId: v.engagementId, importId: v.importId, tbLineId },
      });
      await tx.statementLineAssignment.create({
        data: {
          engagementId: v.engagementId,
          importId: v.importId,
          tbLineId,
          fundCode: v.fundCode,
          lineItemId: v.lineItemId,
        },
      });
    }
  });

  revalidatePath(`/dashboard/engagements/${v.engagementId}/statements/governmental/balance-sheet`);
}
