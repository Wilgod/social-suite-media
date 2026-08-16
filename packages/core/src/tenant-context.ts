import type { TenantContext } from "./types";

export class CrossTenantAccessError extends Error {
  constructor(resource: string) {
    super(`Cross-tenant access denied for resource: ${resource}`);
    this.name = "CrossTenantAccessError";
  }
}

/**
 * Every row fetched by organization-scoped id must be checked against the
 * caller's TenantContext before use. This is the single choke point that
 * prevents cross-tenant leaks when a lookup is by primary key rather than
 * by a query already filtered on organizationId.
 */
export function assertOwnedByTenant(
  ctx: TenantContext,
  resource: { organizationId: string } | null | undefined,
  resourceName: string,
): asserts resource is { organizationId: string } {
  if (!resource || resource.organizationId !== ctx.organizationId) {
    throw new CrossTenantAccessError(resourceName);
  }
}
