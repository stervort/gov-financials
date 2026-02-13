"use server";
import { db } from "@/src/lib/db";
import { ensureDefaultOrg } from "@/src/server/security/tenant";
import { z } from "zod";

export async function listFunds(engagementId: string) {
  const org = await ensureDefaultOrg();
  await db.engagement.findFirstOrThrow({ where: { id: engagementId, organizationId: org.id } });
  return db.fund.findMany({ where: { engagementId }, orderBy: { fundCode: "asc" } });
}

const UpdateSchema = z.object({
  engagementId: z.string(),
  fundId: z.string(),
  fundType: z.enum(["GOVERNMENTAL","PROPRIETARY","FIDUCIARY","COMPONENT_UNIT_BLENDED","COMPONENT_UNIT_DISCRETE"]),
  isMajor: z.string().optional(),
  name: z.string().optional(),
});

export async function updateFund(formData: FormData) {
  const org = await ensureDefaultOrg();
  const v = UpdateSchema.parse({
    engagementId: formData.get("engagementId"),
    fundId: formData.get("fundId"),
    fundType: formData.get("fundType"),
    isMajor: formData.get("isMajor") ?? undefined,
    name: formData.get("name") ?? undefined,
  });
  await db.engagement.findFirstOrThrow({ where: { id: v.engagementId, organizationId: org.id } });

  await db.fund.update({
    where: { id: v.fundId },
    data: { fundType: v.fundType, isMajor: v.isMajor === "on", name: (v.name?.trim() || null) },
  });
}
