"use server";

import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AccountType, StatementType } from "@prisma/client";

async function assertEngagement(orgId: string, engagementId: string) {
  return db.engagement.findFirstOrThrow({
    where: { id: engagementId, organizationId: orgId },
    select: { id: true },
  });
}

// --- Default templates (ACFR-ish starter set)
// Keep this intentionally minimal; you can expand as you refine the statement builder UX.
const GOV_BS_DEFAULT_LINES: Array<{ label: string; accountType: AccountType }> = [
  { label: "Assets", accountType: AccountType.ASSET },
  { label: "Cash and investments", accountType: AccountType.ASSET },
  { label: "Receivables (net)", accountType: AccountType.ASSET },
  { label: "Due from other funds", accountType: AccountType.ASSET },
  { label: "Prepaid items", accountType: AccountType.ASSET },
  { label: "Total assets", accountType: AccountType.ASSET },

  { label: "Liabilities", accountType: AccountType.LIABILITY },
  { label: "Accounts payable", accountType: AccountType.LIABILITY },
  { label: "Accrued liabilities", accountType: AccountType.LIABILITY },
  { label: "Due to other funds", accountType: AccountType.LIABILITY },
  { label: "Deferred inflows of resources", accountType: AccountType.LIABILITY },
  { label: "Total liabilities", accountType: AccountType.LIABILITY },

  { label: "Fund balances", accountType: AccountType.EQUITY },
  { label: "Total fund balances", accountType: AccountType.EQUITY },
  { label: "Total liabilities and fund balances", accountType: AccountType.EQUITY },
];

const GOV_IS_DEFAULT_LINES: Array<{ label: string; accountType: AccountType }> = [
  { label: "Revenues", accountType: AccountType.REVENUE },
  { label: "Taxes", accountType: AccountType.REVENUE },
  { label: "Intergovernmental", accountType: AccountType.REVENUE },
  { label: "Charges for services", accountType: AccountType.REVENUE },
  { label: "Investment earnings", accountType: AccountType.REVENUE },
  { label: "Total revenues", accountType: AccountType.REVENUE },

  { label: "Expenditures", accountType: AccountType.EXPENSE },
  { label: "General government", accountType: AccountType.EXPENSE },
  { label: "Public safety", accountType: AccountType.EXPENSE },
  { label: "Public works", accountType: AccountType.EXPENSE },
  { label: "Health and welfare", accountType: AccountType.EXPENSE },
  { label: "Total expenditures", accountType: AccountType.EXPENSE },

  { label: "Excess (deficiency) of revenues over expenditures", accountType: AccountType.EQUITY },
  { label: "Other financing sources (uses)", accountType: AccountType.EQUITY },
  { label: "Net change in fund balances", accountType: AccountType.EQUITY },
  { label: "Fund balances, beginning of year", accountType: AccountType.EQUITY },
  { label: "Fund balances, end of year", accountType: AccountType.EQUITY },
];

async function ensureTemplate(
  engagementId: string,
  statement: StatementType,
  name: string,
  lines: Array<{ label: string; accountType: AccountType }>
) {
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
        create: lines.map((l, idx) => ({
          label: l.label,
          accountType: l.accountType,
          sortOrder: idx + 1,
        })),
      },
    },
  });
}

export async function ensureDefaultGovFundTemplates(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  await Promise.all([
    ensureTemplate(
      engagementId,
      StatementType.GOVERNMENTAL_FUNDS_BS,
      "Governmental Funds Balance Sheet",
      GOV_BS_DEFAULT_LINES
    ),
    ensureTemplate(
      engagementId,
      StatementType.GOVERNMENTAL_FUNDS_IS,
      "Statement of Revenues, Expenditures, and Changes in Fund Balances",
      GOV_IS_DEFAULT_LINES
    ),
  ]);

  revalidatePath(`/dashboard/engagements/${engagementId}/statements`);
  revalidatePath(`/dashboard/engagements/${engagementId}/statements/governmental`);
}

export async function getGovernmentalStatementOverview(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  // Ensure default templates exist (idempotent)
  await ensureDefaultGovFundTemplates(engagementId);

  const [latestImport, fundCount, templates] = await Promise.all([
    db.trialBalanceImport.findFirst({
      where: { engagementId, status: "IMPORTED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    db.fund.count({ where: { engagementId } }),
    db.statementTemplate.findMany({
      where: { engagementId, statement: { in: [StatementType.GOVERNMENTAL_FUNDS_BS, StatementType.GOVERNMENTAL_FUNDS_IS] } },
      select: { id: true, statement: true },
    }),
  ]);

  const byStatement: Record<string, string> = {};
  for (const t of templates) byStatement[t.statement] = t.id;

  return {
    hasImportedTB: !!latestImport,
    importId: latestImport?.id ?? null,
    fundCount,
    templateCount: templates.length,
    templates: {
      balanceSheet: byStatement[StatementType.GOVERNMENTAL_FUNDS_BS] ?? null,
      operating: byStatement[StatementType.GOVERNMENTAL_FUNDS_IS] ?? null,
    },
  };
}

// --- Future: save/load templates, assignments, etc.
// For now we only need a basic foundation so the Statements UI can render.

const UpsertLineItem = z.object({
  engagementId: z.string().min(1),
  templateId: z.string().min(1),
  label: z.string().min(1),
  accountType: z.nativeEnum(AccountType),
  sortOrder: z.number().int().positive().optional(),
});

export async function upsertStatementLineItem(payload: z.infer<typeof UpsertLineItem>) {
  const org = await ensureDefaultOrg();
  const v = UpsertLineItem.parse(payload);
  await assertEngagement(org.id, v.engagementId);

  const existing = await db.statementLineItem.findFirst({
    // There is no separate "code" column in the DB.
    // For now, treat (templateId, label) as the stable identifier.
    where: { templateId: v.templateId, label: v.label },
    select: { id: true },
  });

  if (existing) {
    await db.statementLineItem.update({
      where: { id: existing.id },
      data: {
        label: v.label,
        accountType: v.accountType,
        sortOrder: v.sortOrder ?? undefined,
      },
    });
  } else {
    await db.statementLineItem.create({
      data: {
        templateId: v.templateId,
        label: v.label,
        accountType: v.accountType,
        sortOrder: v.sortOrder ?? 999,
      },
    });
  }

  revalidatePath(`/dashboard/engagements/${v.engagementId}/statements`);
  revalidatePath(`/dashboard/engagements/${v.engagementId}/statements/governmental`);
}
