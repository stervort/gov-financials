"use server";

import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { revalidatePath } from "next/cache";
import { FsType, StatementType } from "@prisma/client";

async function assertEngagement(orgId: string, engagementId: string) {
  return db.engagement.findFirstOrThrow({
    where: { id: engagementId, organizationId: orgId },
    select: { id: true },
  });
}

// UI-friendly aliases (keeps routes readable) -> Prisma enum values
export type StatementTemplateKey = "GOV_FUNDS_BALANCE_SHEET" | "GOV_FUNDS_REVENUES_EXP_CHANGES";

function keyToStatementType(key: StatementTemplateKey): StatementType {
  switch (key) {
    case "GOV_FUNDS_BALANCE_SHEET":
      return "GOVERNMENTAL_FUNDS_BS";
    case "GOV_FUNDS_REVENUES_EXP_CHANGES":
      return "GOVERNMENTAL_FUNDS_IS";
  }
}

type DefaultLineItem = { name: string; fsType: FsType };

// Minimal default line items (illustrative ACFR-ish). Users can refine later.
const GOV_FUNDS_BS_DEFAULTS: DefaultLineItem[] = [
  { name: "Cash and pooled investments", fsType: "ASSET" },
  { name: "Receivables", fsType: "ASSET" },
  { name: "Due from other funds", fsType: "ASSET" },
  { name: "Inventory", fsType: "ASSET" },
  { name: "Prepaid items", fsType: "ASSET" },
  { name: "Total assets", fsType: "ASSET" },

  { name: "Accounts payable", fsType: "LIABILITY" },
  { name: "Accrued liabilities", fsType: "LIABILITY" },
  { name: "Due to other funds", fsType: "LIABILITY" },
  { name: "Unearned revenue", fsType: "LIABILITY" },
  { name: "Total liabilities", fsType: "LIABILITY" },

  { name: "Fund balances", fsType: "EQUITY" },
  { name: "Total liabilities and fund balances", fsType: "EQUITY" },
];

const GOV_FUNDS_IS_DEFAULTS: DefaultLineItem[] = [
  { name: "Revenues", fsType: "REVENUE" },
  { name: "Expenditures", fsType: "EXPENSE" },
  { name: "Excess (deficiency) of revenues over expenditures", fsType: "REVENUE" },
  { name: "Other financing sources (uses)", fsType: "REVENUE" },
  { name: "Net change in fund balances", fsType: "EQUITY" },
];

async function ensureDefaultTemplate(engagementId: string, statement: StatementType, name: string, defaults: DefaultLineItem[]) {
  const existing = await db.statementTemplate.findFirst({
    where: { engagementId, statement },
    select: { id: true },
  });
  if (existing) return;

  await db.statementTemplate.create({
    data: {
      engagementId,
      statement,
      name,
      lineItems: {
        create: defaults.map((li, idx) => ({
          name: li.name,
          fsType: li.fsType,
          order: idx,
        })),
      },
    },
  });
}

export async function ensureDefaultGovernmentalTemplates(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  await ensureDefaultTemplate(
    engagementId,
    "GOVERNMENTAL_FUNDS_BS",
    "Governmental Funds Balance Sheet (Default)",
    GOV_FUNDS_BS_DEFAULTS
  );

  await ensureDefaultTemplate(
    engagementId,
    "GOVERNMENTAL_FUNDS_IS",
    "Statement of Revenues, Expenditures, and Changes in Fund Balances (Default)",
    GOV_FUNDS_IS_DEFAULTS
  );
}

export async function getGovernmentalStatementOverview(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  await ensureDefaultGovernmentalTemplates(engagementId);

  const latestTB = await db.trialBalanceImport.findFirst({
    where: { engagementId, status: "IMPORTED" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const [fundCount, templateCount] = await Promise.all([
    db.fund.count({ where: { engagementId } }),
    db.statementTemplate.count({
      where: { engagementId, statement: { in: ["GOVERNMENTAL_FUNDS_BS", "GOVERNMENTAL_FUNDS_IS"] } },
    }),
  ]);

  return {
    hasImportedTB: !!latestTB,
    fundCount,
    templateCount,
  };
}

export async function getGovernmentalTemplate(engagementId: string, key: StatementTemplateKey) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);
  await ensureDefaultGovernmentalTemplates(engagementId);

  const statement = keyToStatementType(key);

  return db.statementTemplate.findFirstOrThrow({
    where: { engagementId, statement },
    include: { lineItems: { orderBy: { order: "asc" } } },
  });
}

// Placeholder hook for when we start persisting statement-level assignments.
// For now, just revalidate pages after any future changes.
export async function revalidateStatements(engagementId: string) {
  revalidatePath(`/dashboard/engagements/${engagementId}/statements`);
  revalidatePath(`/dashboard/engagements/${engagementId}/statements/governmental`);
}
