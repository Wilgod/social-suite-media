import { redirect } from "next/navigation";
import { tenantClient, type TenantPrismaClient } from "@social-suite/db";
import type { TenantContext } from "@social-suite/core";
import { auth } from "@/auth";

/** Every server component/route/action that touches tenant data calls this first. */
export async function requireTenantContext(): Promise<TenantContext> {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) {
    redirect("/login");
  }
  return { organizationId: session.organizationId, userId: session.user.id };
}

export async function requireTenantDb(): Promise<{ ctx: TenantContext; db: TenantPrismaClient }> {
  const ctx = await requireTenantContext();
  return { ctx, db: tenantClient(ctx) };
}
