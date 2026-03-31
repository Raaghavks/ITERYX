import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession(["doctor", "administrator", "receptionist"]);

  return <PortalShell user={session}>{children}</PortalShell>;
}
