"use server";

import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { revalidatePath } from "next/cache";
import { AccountType, StatementType } from "@prisma/client";

async function assertEngagement(orgId: string, engagementId: string) {
  return db.engagement.findFirstOrThrow({
    where: { id: engagementId, organizationId: orgId },
    select: { id: true },
  });
}

// We need the latest imported TB as the “current” dataset for statements.
export async function getLatestImportedTB(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  return db.trialBalanceImport.findFirst({
    where: { engagementId, status: "IMPORTED" },
    orderBy: { createdAt: "desc" },
    select: { id: true, engagementId: true, createdAt: true },
  });
}

/**
 * Ensures a default illustrative template exists for Gov Funds:
 * - Balance Sheet (GOVERNMENTAL_FUNDS_BS)
 * - Statement of Revenues/Expenditures/Changes in Fund Balances (GOVERNMENTAL_FUNDS_IS)
 *
 * These are “starter” templates users can edit later.
 */
export async function ensureDefaultGovFundTemplates(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  // 1) Gov Funds Balance Sheet
  const existingBS = await db.statementTemplate.findFirst({
    where: { engagementId, statement: StatementType.GOVERNMENTAL_FUNDS_BS },
    select: { id: true },
  });

  if (!existingBS) {
    await db.statementTemplate.create({
      data: {
        engagementId,
        statement: StatementType.GOVERNMENTAL_FUNDS_BS,
        name: "Default - Gov Funds Balance Sheet",
        isDefault: true,
        lineItems: {
          create: [
            // Assets
            { sortOrder: 10, label: "Cash and investments", accountType: AccountType.ASSET },
            { sortOrder: 20, label: "Receivables (net)", accountType: AccountType.ASSET },
            { sortOrder: 30, label: "Due from other funds", accountType: AccountType.ASSET },
            { sortOrder: 40, label: "Inventories and prepaid items", accountType: AccountType.ASSET },
            { sortOrder: 90, label: "Total assets", accountType: AccountType.ASSET },

            // Liabilities
            { sortOrder: 110, label: "Accounts payable", accountType: AccountType.LIABILITY },
            { sortOrder: 120, label: "Accrued liabilities", accountType: AccountType.LIABILITY },
            { sortOrder: 130, label: "Due to other funds", accountType: AccountType.LIABILITY },
            { sortOrder: 190, label: "Total liabilities", accountType: AccountType.LIABILITY },

            // Fund balances
            { sortOrder: 210, label: "Nonspendable", accountType: AccountType.EQUITY },
            { sortOrder: 220, label: "Restricted", accountType: AccountType.EQUITY },
            { sortOrder: 230, label: "Committed", accountType: AccountType.EQUITY },
            { sortOrder: 240, label: "Assigned", accountType: AccountType.EQUITY },
            { sortOrder: 250, label: "Unassigned", accountType: AccountType.EQUITY },
            { sortOrder: 290, label: "Total fund balances", accountType: AccountType.EQUITY },

            { sortOrder: 999, label: "Total liabilities and fund balances", accountType: AccountType.OTHER },
          ],
        },
      },
      select: { id: true },
    });
  }

  // 2) Gov Funds Operating Statement (Revenues/Expenditures/Changes)
  const existingIS = await db.statementTemplate.findFirst({
    where: { engagementId, statement: StatementType.GOVERNMENTAL_FUNDS_IS },
    select: { id: true },
  });

  if (!existingIS) {
    await db.statementTemplate.create({
      data: {
        engagementId,
        statement: StatementType.GOVERNMENTAL_FUNDS_IS,
        name: "Default - Gov Funds Revenues/Expenditures/Changes",
        isDefault: true,
        lineItems: {
          create: [
            // Revenues
            { sortOrder: 10, label: "Taxes", accountType: AccountType.REVENUE },
            { sortOrder: 20, label: "Intergovernmental", accountType: AccountType.REVENUE },
            { sortOrder: 30, label: "Charges for services", accountType: AccountType.REVENUE },
            { sortOrder: 40, label: "Fines and forfeitures", accountType: AccountType.REVENUE },
            { sortOrder: 50, label: "Investment earnings", accountType: AccountType.REVENUE },
            { sortOrder: 90, label: "Total revenues", accountType: AccountType.REVENUE },

            // Expenditures
            { sortOrder: 110, label: "General government", accountType: AccountType.EXPENSE },
            { sortOrder: 120, label: "Public safety", accountType: AccountType.EXPENSE },
            { sortOrder: 130, label: "Public works", accountType: AccountType.EXPENSE },
            { sortOrder: 140, label: "Culture and recreation", accountType: AccountType.EXPENSE },
            { sortOrder: 150, label: "Community development", accountType: AccountType.EXPENSE },
            { sortOrder: 160, label: "Debt service - principal", accountType: AccountType.EXPENSE },
            { sortOrder: 170, label: "Debt service - interest and fiscal charges", accountType: AccountType.EXPENSE },
            { sortOrder: 190, label: "Total expenditures", accountType: AccountType.EXPENSE },

            { sortOrder: 210, label: "Excess (deficiency) of revenues over expenditures", accountType: AccountType.OTHER },

            // Other financing sources (uses)
            { sortOrder: 310, label: "Transfers in", accountType: AccountType.OTHER },
            { sortOrder: 320, label: "Transfers out", accountType: AccountType.OTHER },
            { sortOrder: 330, label: "Issuance of debt", accountType: AccountType.OTHER },
            { sortOrder: 390, label: "Total other financing sources (uses)", accountType: AccountType.OTHER },

            { sortOrder: 410, label: "Net change in fund balances", accountType: AccountType.OTHER },
            { sortOrder: 510, label: "Fund balances - beginning of year", accountType: AccountType.EQUITY },
            { sortOrder: 610, label: "Fund balances - end of year", accountType: AccountType.EQUITY },
          ],
        },
      },
      select: { id: true },
    });
  }

  revalidatePath(`/dashboard/engagements/${engagementId}/statements`);
  revalidatePath(`/dashboard/engagements/${engagementId}`);
}

// Simple helper for UI routing
export async function canProceedToStatements(engagementId: string) {
  const latest = await getLatestImportedTB(engagementId);
  if (!latest) return { ok: false as const, reason: "No imported trial balance found." };

  // If you want later: enforce that all lines have fundCode before statements.
  // For now, just return OK.
  return { ok: true as const, importId: latest.id };
}
