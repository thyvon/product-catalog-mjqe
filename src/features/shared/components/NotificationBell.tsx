import { useState } from "react";
import { Bell, PackageSearch, FileText, Truck, CheckCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: React.ElementType;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    title: "New Supplier Registered",
    message: "ABC Trading Co. submitted a new vendor registration.",
    time: "2m ago",
    read: false,
    icon: Truck,
  },
  {
    id: "2",
    title: "Debit Note Generated",
    message: "DN-2024-0042 has been generated for Warehouse A.",
    time: "1h ago",
    read: false,
    icon: FileText,
  },
  {
    id: "3",
    title: "Low Stock Alert",
    message: "SKU-00123 stock level is below the minimum threshold.",
    time: "3h ago",
    read: false,
    icon: PackageSearch,
  },
  {
    id: "4",
    title: "Product Import Complete",
    message: "148 products were imported successfully from Excel.",
    time: "Yesterday",
    read: true,
    icon: Info,
  },
];

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={
        <Button variant="ghost" size="icon" className="relative" />
      }>
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="default" className="h-4 min-w-4 px-1 font-mono text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="size-3" />
              Mark all read
            </Button>
          )}
        </div>

        <Separator />

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Bell className="size-8 opacity-30" />
              <p className="text-xs">No notifications</p>
            </div>
          ) : (
            notifications.map((n, i) => (
              <div key={n.id}>
                <button
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                    !n.read && "bg-primary/5"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                    n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                  )}>
                    <n.icon className="size-3.5" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-xs font-semibold leading-snug", n.read && "text-muted-foreground")}>
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{n.time}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-2">
                      {n.message}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
                {i < notifications.length - 1 && <Separator />}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
