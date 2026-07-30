import type { ReactNode } from "react";

interface PageContentProps {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "full";
  className?: string;
}

const maxWidthClasses: Record<string, string> = {
  sm: "max-w-2xl mx-auto",
  md: "max-w-4xl mx-auto",
  lg: "max-w-7xl mx-auto",
  full: "",
};

export default function PageContent({ children, maxWidth = "full", className = "" }: PageContentProps) {
  const mw = maxWidthClasses[maxWidth] || "";
  return (
    <div className={`p-4 lg:p-6 ${mw} ${className}`.trim()}>
      {children}
    </div>
  );
}
