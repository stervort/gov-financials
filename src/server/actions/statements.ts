export async function getGovernmentalStatementOverview(engagementId: string) {
  const org = await ensureDefaultOrg();
  await assertEngagement(org.id, engagementId);

  // Ensure default templates exist (idempotent)
  await ensureDefaultGovFundTemplates(engagementId);

  const [latestImport, templateCount, fundCount] = await Promise.all([
    db.trialBalanceImport.findFirst({
      where: { engagementId, status: "IMPORTED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    db.statementTemplate.count({
      where: {
        engagementId,
        statement: { in: [StatementType.GOVERNMENTAL_FUNDS_BS, StatementType.GOVERNMENTAL_FUNDS_IS] },
      },
    }),
    db.fund.count({
      where: { engagementId },
    }),
  ]);

  return {
    hasImportedTB: !!latestImport,
    importId: latestImport?.id ?? null,
    templateCount,
    fundCount,
  };
}
