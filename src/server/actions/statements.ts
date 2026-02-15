export async function getGovernmentalStatementOverview(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  // Make sure the default templates exist (safe to call repeatedly)
  await ensureDefaultGovFundTemplates(engagementId);

  const [latestImport, templates] = await Promise.all([
    db.trialBalanceImport.findFirst({
      where: { engagementId, status: "IMPORTED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    db.statementTemplate.findMany({
      where: {
        engagementId,
        statement: { in: [StatementType.GOVERNMENTAL_FUNDS_BS, StatementType.GOVERNMENTAL_FUNDS_IS] },
      },
      select: { id: true, statement: true, name: true, isDefault: true },
    }),
  ]);

  const bs = templates.find((t) => t.statement === StatementType.GOVERNMENTAL_FUNDS_BS) ?? null;
  const is = templates.find((t) => t.statement === StatementType.GOVERNMENTAL_FUNDS_IS) ?? null;

  return {
    hasImportedTB: !!latestImport,
    importId: latestImport?.id ?? null,
    templates: {
      balanceSheet: bs,
      operating: is,
    },
  };
}
