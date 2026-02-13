"use server";
import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { z } from "zod";
import { detectFund } from "@/src/server/engine/tb/fundDetection";

export async function listFundRules(engagementId: string) {
  const org = await ensureDefaultOrg();
  await db.engagement.findFirstOrThrow({ where: { id: engagementId, organizationId: org.id } });
  return db.fundDetectionRule.findMany({ where: { engagementId }, orderBy: { createdAt: "asc" } });
}

const CreateSchema = z.object({
  engagementId: z.string().min(1),
  name: z.string().min(2),
  accountRegex: z.string().min(4),
  captureGroup: z.string().min(1),
});

export async function createFundRule(formData: FormData) {
  const org = await ensureDefaultOrg();
  const v = CreateSchema.parse({
    engagementId: formData.get("engagementId"),
    name: formData.get("name"),
    accountRegex: formData.get("accountRegex"),
    captureGroup: formData.get("captureGroup"),
  });
  await db.engagement.findFirstOrThrow({ where: { id: v.engagementId, organizationId: org.id } });

  new RegExp(v.accountRegex); // validate

  await db.fundDetectionRule.create({
    data: { engagementId: v.engagementId, name: v.name, accountRegex: v.accountRegex, captureGroup: Number(v.captureGroup), enabled: true },
  });
}

const ToggleSchema = z.object({ engagementId: z.string(), ruleId: z.string(), enabled: z.string() });

export async function toggleFundRule(formData: FormData) {
  const org = await ensureDefaultOrg();
  const v = ToggleSchema.parse({ engagementId: formData.get("engagementId"), ruleId: formData.get("ruleId"), enabled: formData.get("enabled") });
  await db.engagement.findFirstOrThrow({ where: { id: v.engagementId, organizationId: org.id } });
  await db.fundDetectionRule.update({ where: { id: v.ruleId }, data: { enabled: v.enabled === "true" } });
}

export async function rerunFundDetection(formData: FormData) {
  const org = await ensureDefaultOrg();
  const engagementId = String(formData.get("engagementId"));
  await db.engagement.findFirstOrThrow({ where: { id: engagementId, organizationId: org.id } });

  const rules = await db.fundDetectionRule.findMany({ where: { engagementId } });
  const latest = await db.trialBalanceImport.findFirst({ where: { engagementId }, orderBy: { createdAt: "desc" } });
  if (!latest) return;

  const rr = rules.map(r => ({ accountRegex: r.accountRegex, captureGroup: r.captureGroup, enabled: r.enabled }));
  const lines = await db.trialBalanceLine.findMany({ where: { importId: latest.id } });

  await db.trialBalanceLine.updateMany({ where: { importId: latest.id }, data: { fundCode: null } });

  for (const ln of lines) {
    const f = detectFund(ln.account, rr);
    if (!f) continue;
    await db.trialBalanceLine.update({ where: { id: ln.id }, data: { fundCode: f } });
    await db.fund.upsert({
      where: { engagementId_fundCode: { engagementId, fundCode: f } },
      update: {},
      create: { engagementId, fundCode: f, fundType: "GOVERNMENTAL" },
    });
  }
}
