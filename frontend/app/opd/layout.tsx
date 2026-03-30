import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth";

export default async function OpdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession(["receptionist", "administrator"]);

  return <PortalShell user={session}>{children}</PortalShell>;
}
