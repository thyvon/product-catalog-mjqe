import {
  LayoutDashboard,
  ShoppingBag,
  Building2,
  FileText,
  ClipboardList,
  Receipt,
  Mail,
  Settings,
  PackageSearch,
  Users,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType;
}

export const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/catalog", label: "Catalog", icon: ShoppingBag },
  { to: "/product-management", label: "Product Management", icon: PackageSearch },
  { to: "/supplier-register", label: "Supplier Register", icon: Building2 },
  { to: "/supplier-docs", label: "Supplier Docs", icon: FileText },
  { to: "/stock-issue-items", label: "Stock Issue Items", icon: ClipboardList },
  { to: "/debit-notes", label: "Debit Notes", icon: Receipt },
  { to: "/debit-note-emails", label: "DN Emails", icon: Mail },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];
