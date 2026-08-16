import type { TenantContext } from "@social-suite/core";
import { prisma } from "./client";

/**
 * Models that carry an organizationId column and must never be queried
 * without it. Every route/worker handler is expected to use tenantClient()
 * instead of the raw prisma singleton when touching these models.
 */
const TENANT_SCOPED_MODELS = new Set([
  "Membership",
  "SocialAccount",
  "Post",
  "PostTarget",
  "MediaAsset",
  "AuditLog",
]);

const READ_OPS = new Set(["findFirst", "findMany", "findUnique", "count", "aggregate", "groupBy"]);
const WRITE_OPS = new Set(["update", "updateMany", "delete", "deleteMany"]);

/**
 * Returns a Prisma client scoped to a single organization: every query
 * against a tenant-scoped model has organizationId injected into its
 * where clause, and every create has organizationId injected into its
 * data, so a missing filter fails closed instead of leaking cross-tenant
 * rows.
 */
export function tenantClient(ctx: TenantContext) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const a = args as { where?: Record<string, unknown>; data?: Record<string, unknown> };

          if (READ_OPS.has(operation) || WRITE_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), organizationId: ctx.organizationId };
          }

          if (operation === "create") {
            a.data = { ...(a.data ?? {}), organizationId: ctx.organizationId };
          }

          if (operation === "createMany" && Array.isArray((a as { data?: unknown[] }).data)) {
            const data = (a as unknown as { data: Record<string, unknown>[] }).data;
            (a as unknown as { data: Record<string, unknown>[] }).data = data.map((row) => ({
              ...row,
              organizationId: ctx.organizationId,
            }));
          }

          return query(a);
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof tenantClient>;
