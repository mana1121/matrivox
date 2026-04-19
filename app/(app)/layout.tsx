import { getCurrentUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={user.role} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
