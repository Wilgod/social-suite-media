import { prisma } from "@social-suite/db";
import { auth, signOut } from "@/auth";
import { requireTenantContext } from "@/lib/tenant";
import { Sidebar } from "./_components/sidebar";
import { Header } from "./_components/header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireTenantContext();
  const session = await auth();

  const [user, organization] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.userId } }),
    prisma.organization.findUnique({ where: { id: ctx.organizationId } }),
  ]);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex flex-1">
      <Sidebar
        userEmail={user?.email ?? ""}
        organizationName={organization?.name ?? ""}
        role={session?.role}
        signOutAction={signOutAction}
      />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto bg-neutral-50">{children}</main>
      </div>
    </div>
  );
}
