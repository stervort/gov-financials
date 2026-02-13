"use server";

import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { parseTBFromCSV, parseTBFromExcel } from "@/src/server/engine/tb/normalize";
import { detectFund } from "@/src/server/engine/tb/fundDetection";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function uploadTB(formData: FormData) {
  const org = await ensureDefaultOrg();
  const engagementId = String(formData.get("engagementId") ?? "");

  if (!engagementId) throw new Error("Missing engagementId");

  const e = await db.engagement.findFirstOrThrow({
    where: { id: engagementId, organizationId: org.id },
    include: { fundRules: true },
  });

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file uploaded");

  const filename = (file.name || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  let rows;
  if (filename.endsWith(".csv")) {
    rows = parseTBFromCSV(buf.toString("utf-8"));
  } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
    rows = parseTBFromExcel(buf);
  } else {
    throw new Error("Unsupported file type. Upload .csv, .xlsx, or .xls");
  }

  const total = rows.reduce((a: number, r: any) => a + (r.finalBalance ?? 0), 0);

  const imp = await db.trialBalanceImport.create({
    data: {
      engagementId,
      filename: file.name,
      status: "IMPORTED",
      rowCount: rows.length,
      totalBalance: total,
      lines: {
        createMany: {
          data: rows.map((r: any) => ({
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

  const rules = e.fundRules.map((r: any) => ({
    accountRegex: r.accountRegex,
    captureGroup: r.captureGroup,
    enabled: r.enabled,
  }));

  const lines = await db.trialBalanceLine.findMany({ where: { importId: imp.id } });

  for (const ln of lines) {
    const f = detectFund(ln.account, rules);
    if (!f) continue;

    await db.trialBalanceLine.update({
      where: { id: ln.id },
      data: { fundCode: f },
    });

    await db.fund.upsert({
      where: { engagementId_fundCode: { engagementId, fundCode: f } },
      update: {},
      create: { engagementId, fundCode: f, fundType: "GOVERNMENTAL" },
    });
  }

  // refresh UI + bounce back so it "feels" like it worked
  revalidatePath(`/dashboard/engagements/${engagementId}`);
  revalidatePath(`/dashboard/engagements/${engagementId}/tb`);
  revalidatePath(`/dashboard`);
  redirect(`/dashboard/engagements/${engagementId}/tb`);
}

export async function clearTB(formData: FormData) {
  const org = await ensureDefaultOrg();
  const engagementId = String(formData.get("engagementId") ?? "");

  if (!engagementId) return;

  // verify it belongs to our org
  await db.engagement.findFirstOrThrow({
    where: { id: engagementId, organizationId: org.id },
  });

  await db.$transaction(async (tx) => {
    const imports = await tx.trialBalanceImport.findMany({
      where: { engagementId },
      select: { id: true },
    });
    const importIds = imports.map((x) => x.id);

    if (importIds.length) {
      await tx.trialBalanceLine.deleteMany({ where: { importId: { in: importIds } } });
      await tx.trialBalanceImport.deleteMany({ where: { id: { in: importIds } } });
    }

    // funds are derived from TB import in V1, so clear them too
    await tx.fund.deleteMany({ where: { engagementId } });
  });

  revalidatePath(`/dashboard/engagements/${engagementId}`);
  revalidatePath(`/dashboard/engagements/${engagementId}/tb`);
  revalidatePath(`/dashboard`);
  redirect(`/dashboard/engagements/${engagementId}`);
}

export async function getLatestImport(engagementId: string) {
  const org = await ensureDefaultOrg();
  await db.engagement.findFirstOrThrow({ where: { id: engagementId, organizationId: org.id } });

  return db.trialBalanceImport.findFirst({
    where: { engagementId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getImportPreview(importId: string) {
  return db.trialBalanceImport.findFirstOrThrow({
    where: { id: importId },
    include: { lines: { take: 50, orderBy: { account: "asc" } } },
  });
}
