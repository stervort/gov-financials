"use server";
import { db } from "@/src/lib/db";

/** Auth stub: always uses a single default organization. Replace with real auth later. */
export async function ensureDefaultOrg() {
  const name = "Default Org";
  let org = await db.organization.findFirst({ where: { name } });
  if (!org) org = await db.organization.create({ data: { name } });
  return org;
}
