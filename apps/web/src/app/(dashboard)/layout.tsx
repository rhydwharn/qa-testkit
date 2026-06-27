import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/CommandPalette";
import { TestIds } from "@/lib/test-ids";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.tenantId) redirect("/onboarding");

  return (
    <div className="flex h-screen overflow-hidden bg-background" data-testid="dashboard-layout">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0" data-testid="dashboard-main-container">
        <Topbar user={session.user as { name?: string | null; email?: string | null; image?: string | null }} />
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col" data-testid="dashboard-main-content">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
