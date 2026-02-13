"use server";
import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { parseTBFromCSV } from "@/src/server/engine/tb/normalize";

export async function uploadTB(formData: FormData) {
  const org = await ensureDefaultOrg();
  const engagementId = String(formData.get("engagementId"));

  const e = await db.engagement.findFirstOrThrow({
    where: { id: engagementId, organizationId: org.id },
    include: { fundRules: true },
  });

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");
  const text = Buffer.from(await file.arrayBuffer()).toString("utf-8");

  const rows = parseTBFromCSV(text);

  const imp = await db.trialBalanceImport.create({
    data: {
      engagementId,
      filename: file.name,
      status: "IMPORTED",
      lines: { createMany: { data: rows.map(r => ({
        account: r.account,
        description: r.description,
        finalBalance: r.finalBalance,
        auditGroup: r.auditGroup,
        auditSubgroup: r.auditSubgroup,
      })) } }
    }
  });

  // Infer fund code from account using rules (default: 10-xxxx => 10)
  const rules = e.fundRules.map(r => ({ re: new RegExp(r.accountRegex), g: r.captureGroup }));
  const lines = await db.trialBalanceLine.findMany({ where: { importId: imp.id } });

  for (const ln of lines) {
    let fund: string | null = null;
    for (const r of rules) {
      const m = r.re.exec(ln.account);
      if (m && m[r.g]) { fund = m[r.g]; break; }
    }
    if (fund) {
      await db.trialBalanceLine.update({ where: { id: ln.id }, data: { fundCode: fund } });
      await db.fund.upsert({
        where: { engagementId_fundCode: { engagementId, fundCode: fund } },
        update: {},
        create: { engagementId, fundCode: fund, fundType: "GOVERNMENTAL" },
      });
    }
  }
}

export async function getLatestImports(engagementId: string) {
  const org = await ensureDefaultOrg();
  await db.engagement.findFirstOrThrow({ where: { id: engagementId, organizationId: org.id } });
  return db.trialBalanceImport.findMany({ where: { engagementId }, orderBy: { createdAt: "desc" }, take: 10 });
}
