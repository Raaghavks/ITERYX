import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession(["administrator"]);

  return <PortalShell user={session}>{children}</PortalShell>;
}
