import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, Bot, BookOpen, Home, Users, Wrench } from "lucide-react";

const LINKS = [
  { to: "/",            label: "Home",              icon: Home },
  { to: "/toolkits",    label: "Toolkits",           icon: BookOpen },
  { to: "/agents",      label: "Agents",             icon: Bot },
  { to: "/tools",       label: "Tools",              icon: Wrench },
  { to: "/consumers",   label: "Consumers & Personas", icon: Users },
  { to: "/executive",   label: "Executive",          icon: BarChart3 },
];

export function Nav() {
  const { pathname } = useLocation();
  const isExec = pathname === "/executive";

  if (isExec) return null;

  return (
    <nav className="no-print fixed top-0 left-0 right-0 z-50 bg-surface-raised/90 backdrop-blur border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 h-14">
        <span className="text-sm font-bold text-slate-100 mr-4 flex items-center gap-2">
          <span className="text-accent font-black">⬡</span>
          Prolifics AI Catalog
        </span>
        {LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-accent/20 text-accent"
                  : "text-slate-500 hover:text-slate-300 hover:bg-surface-hover"
              }`
            }
          >
            <Icon size={13} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
