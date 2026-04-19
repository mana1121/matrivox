import { requireAdmin } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import DemoConsole from "./DemoConsole";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const me = await requireAdmin();
  return (
    <>
      <TopBar user={me} title="Demo Console" />
      <main className="p-6">
        <DemoConsole />
      </main>
    </>
  );
}
