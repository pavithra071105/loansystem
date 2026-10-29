import { Calculator, FilePlus2, History, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const APPLICANT_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/apply", label: "New application", icon: FilePlus2 },
  { to: "/history", label: "History", icon: History },
  { to: "/calculators", label: "Calculators", icon: Calculator },
];
const ADMIN_NAV = [
  { to: "/admin", label: "Analytics", icon: ShieldCheck, end: true },
  { to: "/calculators", label: "Calculators", icon: Calculator },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const nav = user?.role === "admin" ? ADMIN_NAV : APPLICANT_NAV;
  const [signOutError, setSignOutError] = useState("");
  const leave = async () => {
    setSignOutError("");
    try { await signOut(); navigate("/login"); }
    catch { setSignOutError("Unable to sign out. Check your connection and try again."); }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden flex-col bg-navy p-5 text-white lg:flex lg:sticky lg:top-0 lg:h-screen">
        <Logo dark className="mb-10 px-2" />
        <nav className="flex flex-col gap-1" aria-label="Main">
          {nav.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink key={to} to={to} {...rest}
              className={({ isActive }) => cn("relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                isActive ? "bg-white/10 text-white before:absolute before:inset-y-2 before:-left-5 before:w-1 before:rounded-r before:bg-marigold" : "text-white/65 hover:bg-white/5 hover:text-white")}>
              <Icon className="size-[18px]" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-lg bg-white/5 p-3">
          <p className="truncate text-sm font-semibold">{user?.name}</p>
          <p className="truncate text-xs text-white/60">{user?.email}</p>
          <button onClick={leave} className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-semibold text-white/70 hover:text-white">
            <LogOut className="size-3.5" />Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-surface lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo />
            <button onClick={leave} aria-label="Sign out" className="cursor-pointer rounded-lg p-2 text-muted hover:bg-paper"><LogOut className="size-5" /></button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Main">
            {nav.map(({ to, label, ...rest }) => (
              <NavLink key={to} to={to} {...rest}
                className={({ isActive }) => cn("whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold", isActive ? "bg-navy text-white" : "text-muted")}>
                {label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:py-10">{signOutError && <p role="alert" className="mb-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{signOutError}</p>}<Outlet /></main>
      </div>
    </div>
  );
}
