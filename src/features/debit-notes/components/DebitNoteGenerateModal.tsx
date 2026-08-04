import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import BaseModal from "@/features/shared/components/BaseModal";
import DatePicker from "@/features/shared/components/DatePicker";
import TextField from "@/features/shared/components/TextField";
import ConfirmModal from "@/features/shared/components/ConfirmModal";
import { useToast } from "@/features/shared/components/Toast";
import { useAuth } from "@/features/auth/AuthContext";
import { FormLabel } from "@/features/shared/components/FormLabel";

interface DebitNoteGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: () => void;
}

interface GenerateParams {
  startDate: string;
  endDate: string;
  warehouse?: string;
  department?: string;
  campus?: string;
  createdBy: string;
  skipMissingEmailGroups?: boolean;
}

export default function DebitNoteGenerateModal({ isOpen, onClose, onGenerated }: DebitNoteGenerateModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [genStartDate, setGenStartDate] = useState("");
  const [genEndDate, setGenEndDate] = useState("");
  const [genWarehouse, setGenWarehouse] = useState("");
  const [genDepartment, setGenDepartment] = useState("");
  const [genCampus, setGenCampus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [pendingSkip, setPendingSkip] = useState<null | { params: GenerateParams; missingGroups: string[] }>(null);

  const buildParams = (skipMissingEmailGroups?: boolean): GenerateParams => ({
    startDate: genStartDate,
    endDate: genEndDate,
    ...(genWarehouse ? { warehouse: genWarehouse } : {}),
    ...(genDepartment ? { department: genDepartment } : {}),
    ...(genCampus ? { campus: genCampus } : {}),
    createdBy: user?.username || "system",
    ...(skipMissingEmailGroups ? { skipMissingEmailGroups: true } : {}),
  });

  const runGenerate = async (params: GenerateParams) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/debit-notes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (res.ok) {
        onGenerated();
        const skippedText = data.skipped ? ` ${data.skipped} group(s) were skipped because they have no email configuration.` : "";
        toast.success(`Generated ${data.count} debit note(s) successfully.${skippedText}`);
      } else if (data.code === "MISSING_EMAIL_CONFIGS") {
        setPendingSkip({ params, missingGroups: data.missingGroups || [] });
      } else {
        toast.error(data.error || "Failed to generate. Please try again.");
      }
    } catch {
      toast.error("Failed to generate debit notes. Please try again.");
    } finally { setGenerating(false); }
  };

  const confirmSkip = async () => {
    if (!pendingSkip) return;
    const { params } = pendingSkip;
    setPendingSkip(null);
    await runGenerate({ ...params, skipMissingEmailGroups: true });
  };

  const cancelSkip = () => {
    if (pendingSkip) toast.error(`Generation cancelled: ${pendingSkip.missingGroups.length} group(s) have no email configuration.`);
    setPendingSkip(null);
  };

  const handleGenerate = async () => {
    if (!genStartDate || !genEndDate) {
      toast.error("Start date and end date are required.");
      return;
    }
    if (new Date(genEndDate) < new Date(genStartDate)) {
      toast.error("End date cannot be before start date.");
      return;
    }
    await runGenerate(buildParams());
  };

  return (
    <>
      <BaseModal isOpen={isOpen} onClose={onClose} size="md" title="Generate Debit Notes">
        <div className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <DatePicker
                  label="Start Date"
                  value={genStartDate}
                  onChange={setGenStartDate}
                  required
                  className="w-full"
                />
              </div>
              <div>
                <DatePicker
                  label="End Date"
                  value={genEndDate}
                  onChange={setGenEndDate}
                  required
                  className="w-full"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Stock issue items within this date range will be grouped by warehouse/division/department/campus.</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <FormLabel>Warehouse</FormLabel>
                <TextField type="text" value={genWarehouse} onChange={(e) => setGenWarehouse(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <FormLabel>Department</FormLabel>
                <TextField type="text" value={genDepartment} onChange={(e) => setGenDepartment(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <FormLabel>Campus</FormLabel>
                <TextField type="text" value={genCampus} onChange={(e) => setGenCampus(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose} disabled={generating}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating && <Loader2 className="animate-spin" />}
              <span>{generating ? "Generating..." : "Generate"}</span>
            </Button>
          </div>
        </div>
      </BaseModal>

      <ConfirmModal
        isOpen={pendingSkip !== null}
        title="Missing Email Configurations"
        message={`${pendingSkip?.missingGroups.length ?? 0} group(s) have no email configuration (${pendingSkip?.missingGroups.join(", ") || ""}). Skip these groups and generate the rest, or cancel to abort?`}
        confirmLabel="Skip & Generate"
        onConfirm={confirmSkip}
        onCancel={cancelSkip}
      />
    </>
  );
}
