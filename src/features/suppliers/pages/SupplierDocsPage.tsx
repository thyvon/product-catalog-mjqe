import { FileText, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageContent from "@/features/shared/components/PageContent";

export default function SupplierDocsPage() {
  const navigate = useNavigate();

  return (
    <PageContent>
      <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft />
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary text-primary-foreground rounded-lg">
            <FileText className="w-4 h-4" />
          </div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Supplier Docs
          </h1>
        </div>
      </div>

      <div className="grid gap-4">
        <a
          href="/Supplier%20Docs/20260616_Supplier%20Code%20of%20Conduct%20Acknowledgement%20Form%E2%80%8B%20V1.2_Khmer.pdf"
          target="_blank"
          className="block bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-destructive/10 rounded-xl">
              <FileText className="w-6 h-6 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors truncate">
                Supplier Code of Conduct Acknowledgement Form V1.2 (Khmer)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                PDF Document
              </p>
            </div>
            <span className="text-xs font-mono text-primary font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              Open &rarr;
            </span>
          </div>
        </a>

        <a
          href="/Supplier%20Docs/20260617_%20Vendor_%20Registration%20and%20Onboarding%20_Guideline.docx"
          target="_blank"
          className="block bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted rounded-xl">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors truncate">
                Vendor Registration and Onboarding Guideline
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Word Document
              </p>
            </div>
            <span className="text-xs font-mono text-primary font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              Open &rarr;
            </span>
          </div>
        </a>
      </div>

      <div className="bg-muted/50 border border-border rounded-2xl p-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          These documents contain the official Supplier Code of Conduct, Vendor Registration,
          and Onboarding guidelines. Click on a document to open it in a new tab.
        </p>
      </div>
    </div>
    </PageContent>
  );
}
