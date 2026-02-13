"use server";

import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { parseTBFromCSV, parseTBFromExcel } from "@/src/server/engine/tb/normalize";
import { detectFund } from "@/src/server/engine/tb/fundDetection";

export async function uploadTB(formData: FormData) {
  const org = await ensureDefaultOrg();
  const engagementId = String(formData.get("engagementId"));

  const e = await db.engagement.findFirstOrThrow({
    where: { id: engagementId, organizationId: org.id },
    include: { fundRules: true },
  });

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");

  const filename = (file.name || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  let rows;
  if (filename.endsWith(".csv")) {
    const text = buf.toString("utf-8");
    rows = parseTBFromCSV(text);
  } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
    rows = parseTBFromExcel(buf);
  } else {
    throw new Error("Unsupported file type. Upload .csv, .xlsx, or .xls");
  }

  const total = rows.reduce((a, r) => a + (r.finalBalance ?? 0), 0);

  const imp = await db.trialBalanceImport.create({
    data: {
      engagementId,
      filename: file.name,
      status: "IMPORTED",
      rowCount: rows.length,
      totalBalance: total,
      lines: {
        createMany: {
          data: rows.map((r) => ({
            account: r.account,
            description: r.description,
            finalBalance: r.finalBalance,
            auditGroup: r.auditGroup,
            auditSubgroup: r.auditSubgroup,
          })),
        },
      },
    },
  });

  const rules = e.fundRules.map((r) => ({
    accountRegex: r.accountRegex,
    captureGroup: r.captureGroup,
    enabled: r.enabled,
  }));

  const lines = await db.trialBalanceLine.findMany({ where: { importId: imp.id } });

  for (const ln of lines) {
    const f = detectFund(ln.account, rules);
    if (!f) continue;

    await db.trialBalanceLine.update({ where: { id: ln.id }, data: { fundCode: f } });

    await db.fund.upsert({
      where: { engagementId_fundCode: { engagementId, fundCode: f } },
      update: {},
      create: { engagementId, fundCode: f, fundType: "GOVERNMENTAL" },
    });
  }
}

export async function getLatestImport(engagementId: string) {
  const org = await ensureDefaultOrg();
  await db.engagement.findFirstOrThrow({ where: { id: engagementId, organizationId: org.id } });
  return db.trialBalanceImport.findFirst({ where: { engagementId }, orderBy: { createdAt: "desc" } });
}

export async function getImportPreview(importId: string) {
  return db.trialBalanceImport.findFirstOrThrow({
    where: { id: importId },
    include: { lines: { take: 50, orderBy: { account: "asc" } } },
  });
}
