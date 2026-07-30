import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/features/shared/components/AppSidebar";
import AppHeader from "@/features/shared/components/AppHeader";
import AppFooter from "@/features/shared/components/AppFooter";

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    fetch("/api/visit/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: location.pathname }),
    }).catch(() => {});
  }, [location.pathname]);

  return (
    <SidebarProvider defaultOpen className="max-h-svh overflow-hidden">
      <AppSidebar user={user} />

      <SidebarInset className="min-w-0">
        <AppHeader />

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <Outlet />
        </div>

        <AppFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
