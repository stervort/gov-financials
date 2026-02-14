"use server";

import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import {
  parseCSVToMatrix,
  parseExcelToMatrix,
  detectHasHeaders,
  buildRowsFromMatrixWithHeaders,
  buildRowsFromMatrixWithMap,
  TBColumnMap,
} from "@/src/server/engine/tb/normalize";
import { detectFund } from "@/src/server/engine/tb/fundDetection";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function assertEngagement(orgId: string, engagementId: string) {
  return db.engagement.findFirstOrThrow({
    where: { id: engagementId, organizationId: orgId },
    include: { fundRules: true },
  });
}

async function runFundDetection(engagementId: string, importId: string, rules: any[]) {
  const lines = await db.trialBalanceLine.findMany({ where: { importId } });

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
}

export async function uploadTB(formData: FormData) {
  const org = await ensureDefaultOrg();
  const engagementId = String(formData.get("engagementId") ?? "");
  if (!engagementId) throw new Error("Missing engagementId");

  const e = await assertEngagement(org.id, engagementId);

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file uploaded");

  const filenameLower = (file.name || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  let matrix: any[][] = [];
  let fileType: string | null = null;

  if (filenameLower.endsWith(".csv")) {
    fileType = "csv";
    matrix = parseCSVToMatrix(buf.toString("utf-8"));
  } else if (filenameLower.endsWith(".xlsx") || filenameLower.endsWith(".xls")) {
    fileType = "excel";
    matrix = parseExcelToMatrix(buf);
  } else {
    throw new Error("Unsupported file type. Upload .csv, .xlsx, or .xls");
  }

  if (!matrix || matrix.length === 0) throw new Error("File appears empty.");

  // Industry-standard UX: always ask the user to confirm header rows + map columns.
  // We'll *suggest* whether headers are present, but we never auto-import.
  const hasHeadersSuggested = detectHasHeaders(matrix[0] ?? []);

  // Create staging import, redirect to mapping UI
  const imp = await db.trialBalanceImport.create({
    data: {
      engagementId,
      filename: file.name,
      status: "NEEDS_MAPPING",
      fileType: fileType ?? undefined,
      hasHeaders: hasHeadersSuggested,
      rawMatrix: matrix,
      rowCount: 0,
      totalBalance: 0,
    },
  });

  revalidatePath(`/dashboard/engagements/${engagementId}`);
  revalidatePath(`/dashboard/engagements/${engagementId}/tb`);
  redirect(`/dashboard/engagements/${engagementId}/tb/map/${imp.id}`);
}

export async function finalizeTBMapping(formData: FormData) {
  const org = await ensureDefaultOrg();
  const engagementId = String(formData.get("engagementId") ?? "");
  const importId = String(formData.get("importId") ?? "");
  if (!engagementId || !importId) throw new Error("Missing engagementId/importId");

  const e = await assertEngagement(org.id, engagementId);

  const imp = await db.trialBalanceImport.findFirstOrThrow({
    where: { id: importId, engagementId },
  });

  if (imp.status !== "NEEDS_MAPPING") {
    redirect(`/dashboard/engagements/${engagementId}/tb`);
  }

  const raw = imp.rawMatrix as any;
  const matrix: any[][] = Array.isArray(raw) ? raw : [];
  if (!matrix.length) throw new Error("Missing rawMatrix. Re-upload the TB.");

  // Header rows: user chooses how many rows to skip before the TB data starts.
  // If they say "no headers", we skip 0.
  const hasHeaders = String(formData.get("hasHeaders") ?? "").toLowerCase() === "true";
  const headerRowsToSkipRaw = Number(formData.get("headerRowsToSkip") ?? 0);
  const headerRowsToSkip = hasHeaders && Number.isFinite(headerRowsToSkipRaw)
    ? Math.max(0, Math.floor(headerRowsToSkipRaw))
    : 0;

  const dataMatrix = headerRowsToSkip > 0 ? matrix.slice(headerRowsToSkip) : matrix;

  const map: TBColumnMap = {
    accountCol: Number(formData.get("accountCol")),
    descriptionCol: formData.get("descriptionCol") === "" ? null : Number(formData.get("descriptionCol")),
    finalBalanceCol: formData.get("finalBalanceCol") === "" ? null : Number(formData.get("finalBalanceCol")),
    debitCol: formData.get("debitCol") === "" ? null : Number(formData.get("debitCol")),
    creditCol: formData.get("creditCol") === "" ? null : Number(formData.get("creditCol")),
    groupCol: formData.get("groupCol") === "" ? null : Number(formData.get("groupCol")),
    subgroupCol: formData.get("subgroupCol") === "" ? null : Number(formData.get("subgroupCol")),
  };

  if (!Number.isFinite(map.accountCol)) throw new Error("Account column is required.");

  const usingFinal = map.finalBalanceCol != null && Number.isFinite(map.finalBalanceCol);
  const usingDrCr = map.debitCol != null && map.creditCol != null;

  if (!usingFinal && !usingDrCr) {
    throw new Error("Choose either Final Balance column OR both Debit + Credit columns.");
  }

  const rows = buildRowsFromMatrixWithMap(dataMatrix, map);
  const total = rows.reduce((a, r) => a + (r.finalBalance ?? 0), 0);

  await db.$transaction(async (tx) => {
    await tx.trialBalanceLine.deleteMany({ where: { importId } });

    await tx.trialBalanceLine.createMany({
      data: rows.map((r) => ({
        importId,
        account: r.account,
        description: r.description,
        finalBalance: r.finalBalance,
        auditGroup: r.auditGroup,
        auditSubgroup: r.auditSubgroup,
      })),
    });

    await tx.trialBalanceImport.update({
      where: { id: importId },
      data: {
        status: "IMPORTED",
        rowCount: rows.length,
        totalBalance: total,
        hasHeaders,
        columnMap: {
          ...map,
          headerRowsToSkip,
        } as any,
      },
    });
  });

  const rules = e.fundRules.map((r) => ({
    accountRegex: r.accountRegex,
    captureGroup: r.captureGroup,
    enabled: r.enabled,
  }));

  await runFundDetection(engagementId, importId, rules);

  revalidatePath(`/dashboard/engagements/${engagementId}`);
  revalidatePath(`/dashboard/engagements/${engagementId}/tb`);
  revalidatePath(`/dashboard`);
  redirect(`/dashboard/engagements/${engagementId}/tb`);
}

export async function clearTB(formData: FormData) {
  const org = await ensureDefaultOrg();
  const engagementId = String(formData.get("engagementId") ?? "");
  if (!engagementId) return;

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

export async function getImportForMapping(importId: string) {
  return db.trialBalanceImport.findFirstOrThrow({
    where: { id: importId },
    select: {
      id: true,
      engagementId: true,
      filename: true,
      status: true,
      rawMatrix: true,
      hasHeaders: true,
    },
  });
}
