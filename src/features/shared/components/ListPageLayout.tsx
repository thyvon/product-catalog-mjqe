import { Separator } from "@/components/ui/separator";
import Toolbar, { type ToolbarProps } from "@/features/shared/components/Toolbar";

type ListPageLayoutProps = ToolbarProps & {
  children: React.ReactNode;
};

export default function ListPageLayout({ children, ...toolbarProps }: ListPageLayoutProps) {
  return (
    <div className="space-y-4">
      <Toolbar {...toolbarProps} />
      <Separator />
      {children}
    </div>
  );
}
