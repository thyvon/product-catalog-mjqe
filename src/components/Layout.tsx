import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
  Building2,
  Power,
  Menu,
  X,
  Sun,
  Moon,
  PackageOpen,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/catalog", label: "Catalog", icon: ShoppingBag },
  { to: "/supplier-register", label: "Supplier Register", icon: Building2 },
  { to: "/supplier-docs", label: "Supplier Docs", icon: FileText },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [sidebarMini, setSidebarMini] = useState(() => {
    const stored = localStorage.getItem("sidebarMini");
    return stored === "true";
  });

  const toggleSidebarMini = () => {
    setSidebarMini((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarMini", String(next));
      return next;
    });
  };

  useEffect(() => {
    fetch("/api/visit/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: location.pathname }) }).catch(() => {});
  }, [location.pathname]);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem("darkMode");
    const isDark = stored === "true";
    document.documentElement.classList.toggle("dark", isDark);
    return isDark;
  });

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("darkMode", String(next));
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50/50 dark:bg-gray-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          bg-white dark:bg-gray-900 border-r border-slate-100 dark:border-gray-800
          transform transition-all duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${sidebarMini ? "w-16" : "w-64"}
          flex flex-col
        `}
      >
        <div className={`flex items-center h-16 border-b border-slate-100 dark:border-gray-800 shrink-0 ${sidebarMini ? "justify-center px-0" : "gap-3 px-5"}`}>
          <div className="p-1.5 bg-indigo-600 text-white rounded-xl shrink-0">
            <PackageOpen className="w-5 h-5" />
          </div>
          {!sidebarMini && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-black text-slate-900 dark:text-gray-100 tracking-tight leading-tight whitespace-nowrap">
                PROCUREMENT
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-gray-500 font-medium whitespace-nowrap">
                {user?.role || "User"}
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center ${sidebarMini ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                    : "text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-700 dark:hover:text-gray-200"
                }`
              }
              title={sidebarMini ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!sidebarMini && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>


      </aside>

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200`}>
        <header className="h-16 border-b border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleSidebarMini}
              className="hidden lg:flex p-2 text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all"
              title={sidebarMini ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarMini ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <span className="text-xs font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-1">
              {user?.username}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all"
              title={darkMode ? "Light Mode" : "Dark Mode"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-xl z-20 p-4">
                    <p className="text-xs font-black text-slate-900 dark:text-gray-100 mb-3">Notifications</p>
                    <div className="text-center py-6">
                      <Bell className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 dark:text-gray-500">No new notifications</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative border-l border-slate-200 dark:border-gray-700 pl-2">
              <button
                onClick={() => setAvatarOpen(!avatarOpen)}
                className="flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1.5 rounded-xl transition-all cursor-pointer text-left"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
                  {user?.username?.charAt(0) || "U"}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-slate-800 dark:text-gray-200 leading-tight">{user?.username}</p>
                  <p className="text-[10px] text-slate-400 dark:text-gray-500 font-medium leading-tight">{user?.role}</p>
                </div>
              </button>

              {avatarOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAvatarOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-xl z-20 p-2">
                    <button
                      onClick={() => {
                        setAvatarOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all cursor-pointer"
                    >
                      <Power className="w-4 h-4 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        <footer className="shrink-0 border-t border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 lg:px-6 py-3 flex items-center justify-between text-[10px] text-slate-400 dark:text-gray-500 font-mono">
          <span>© {new Date().getFullYear()} PROCUREMENT</span>
          <span>v1.0.0</span>
        </footer>
      </div>
    </div>
  );
}
