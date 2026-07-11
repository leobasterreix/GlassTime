import Link from "next/link";
import { Wrench } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="mk-nav">
        <div className="mk-logo">
          <span className="mk-logo-mark"><Wrench size={16} color="#fff" /></span>
          Admin
        </div>
        <Link href="/agenda" className="btn">
          ← Retour à l'app
        </Link>
      </nav>
      <main className="page" style={{ maxWidth: 760 }}>
        {children}
      </main>
    </>
  );
}
