import NotificationCenter from "@/components/NotificationCenter";
import SwipeNav from "@/components/SwipeNav";
import SyncManager from "@/components/SyncManager";
import TabBar from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SyncManager />
      <div className="app-shell">
        <SwipeNav>{children}</SwipeNav>
      </div>
      <NotificationCenter />
      <TabBar />
    </>
  );
}
