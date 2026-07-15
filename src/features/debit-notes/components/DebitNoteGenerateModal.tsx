import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import BaseModal from "@/features/shared/components/BaseModal";
import DatePicker from "@/features/shared/components/DatePicker";
import { useToast } from "@/features/shared/components/Toast";
import { useAuth } from "@/features/auth/AuthContext";

interface DebitNoteGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: () => void;
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

  const handleGenerate = async () => {
    if (!genStartDate || !genEndDate) {
      toast.error("Start date and end date are required.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/debit-notes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: genStartDate,
          endDate: genEndDate,
          warehouse: genWarehouse || undefined,
          department: genDepartment || undefined,
          campus: genCampus || undefined,
          createdBy: user?.username || "system",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onGenerated();
        toast.success(`Generated ${data.count} debit note(s) successfully.`);
      } else {
        toast.error(data.error || "Failed to generate.");
      }
    } catch {
      toast.error("Failed to generate debit notes.");
    } finally { setGenerating(false); }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-black text-slate-900 dark:text-gray-100">Generate Debit Notes</h2>
          <button onClick={onClose} disabled={generating} className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-all">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
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
          <p className="text-[10px] text-slate-400 -mt-2">Stock issue items within this date range will be grouped by warehouse/department/campus.</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">Warehouse</label>
              <input type="text" value={genWarehouse} onChange={(e) => setGenWarehouse(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">Department</label>
              <input type="text" value={genDepartment} onChange={(e) => setGenDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-gray-400 mb-1">Campus</label>
              <input type="text" value={genCampus} onChange={(e) => setGenCampus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="Optional" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} disabled={generating}
            className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl cursor-pointer disabled:opacity-50 transition-all">
            Cancel
          </button>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm cursor-pointer disabled:opacity-50 transition-all">
            {generating && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{generating ? "Generating..." : "Generate"}</span>
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
