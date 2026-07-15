import React, { useState, useRef } from "react";
import { FileText, Download, CloudUpload, CheckCircle, Eye, XCircle, RefreshCw } from "lucide-react";
import BaseModal from "@/features/shared/components/BaseModal";
import { useToast } from "@/features/shared/components/Toast";

const IMPORT_COLUMNS = [
  "Date", "Code", "Description", "Qty", "UoM", "Unit Price", "Total Amount",
  "Requester", "Campus", "Division", "Department", "Description/ Purpose",
  "Ref.No", "Transaction Type", "Account Code"
];

interface StockImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function StockImportModal({ isOpen, onClose, onImportComplete }: StockImportModalProps) {
  const { toast } = useToast();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadExcelTemplate = async () => {
    const XLSX = await import("xlsx");
    const sampleRows = [
      ["2026-06-01", "ITEM-001", "Sample item description", 10, "Pcs", 5.50, 55.00, "Vun Thy", "PP", "Admin", "IT", "Monthly supply", "IO-2026-001", "Issue", "ACC-001"],
      ["2026-06-02", "ITEM-002", "Another sample item", 5, "Box", 12.00, 60.00, "Sokha", "PP", "Finance", "Accounting", "Office use", "IO-2026-002", "Transfer", "ACC-002"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Issue Items");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Stock_Issue_Items_Template.xlsx";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processFile(f); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f); };

  const processFile = async (file: File) => {
    const XLSX = await import("xlsx");
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (![".xlsx", ".xls", ".csv"].includes(ext)) { toast.error("Invalid format. Use .xlsx, .xls, or .csv."); return; }
    setImportFile(file);
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = ext === ".csv" ? XLSX.read(data, { type: "string" }) : XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (json.length === 0) throw new Error("No data found in spreadsheet.");

        const normalizeDate = (v: any): string => {
          if (!v && v !== 0) return "";
          if (typeof v === "number") {
            return XLSX.SSF.format("yyyy-mm-dd", v);
          }
          if (v instanceof Date) {
            return v.toISOString().slice(0, 10);
          }
          const s = String(v).trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
          const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
          if (m) {
            const [, a, b, c] = m;
            const year = c.length === 2 ? `20${c}` : c;
            const parts = [a, b].map((p) => p.padStart(2, "0"));
            return parseInt(a) > 12 ? `${year}-${parts[1]}-${parts[0]}` : `${year}-${parts[0]}-${parts[1]}`;
          }
          return s;
        };

        const formatted = json.map((row: any) => ({
          itemCode: String(row["Code"] || row["code"] || row["ITEM CODE"] || row["itemCode"] || "").trim(),
          description: String(row["Description"] || row["description"] || row["DESCRIPTION"] || "").trim(),
          quantity: parseFloat(row["Qty"] || row["qty"] || row["QTY"] || row["Quantity"] || 0),
          uom: String(row["UoM"] || row["uom"] || row["UOM"] || row["Unit"] || "Pcs").trim(),
          unitPrice: parseFloat(row["Unit Price"] || row["unitPrice"] || row["UNIT PRICE"] || 0),
          totalPrice: parseFloat(row["Total Amount"] || row["totalPrice"] || row["TOTAL AMOUNT"] || 0),
          transactionDate: normalizeDate(row["Date"] ?? row["date"] ?? row["DATE"] ?? ""),
          warehouse: String(row["Warehouse"] || row["warehouse"] || row["WAREHOUSE"] || "").trim(),
          division: String(row["Division"] || row["division"] || row["DIVISION"] || "").trim(),
          department: String(row["Department"] || row["department"] || row["DEPARTMENT"] || "").trim(),
          campus: String(row["Campus"] || row["campus"] || row["CAMPUS"] || "").trim(),
          requesterName: String(row["Requester"] || row["requesterName"] || row["REQUESTER"] || "").trim(),
          referenceNo: String(row["Ref.No"] || row["refNo"] || row["REF.NO"] || row["Reference No"] || row["referenceNo"] || "").trim(),
          transactionType: String(row["Transaction Type"] || row["transactionType"] || row["TRANSACTION TYPE"] || "").trim(),
          accountCode: String(row["Account Code"] || row["accountCode"] || row["ACCOUNT CODE"] || "").trim(),
          remarks: String(row["Description/ Purpose"] || row["remarks"] || row["Remarks"] || "").trim(),
        }));

        const valid = formatted.filter((r: any) => r.itemCode && r.description);
        if (valid.length === 0) throw new Error("No rows with valid 'Code' and 'Description' headers.");
        setParsedRows(valid);
      } catch (err: any) { toast.error(err.message || "Failed to parse file."); setImportFile(null); setParsedRows([]); }
      finally { setImportLoading(false); }
    };
    if (ext === ".csv") reader.readAsText(file); else reader.readAsBinaryString(file);
  };

  const submitImport = async () => {
    if (parsedRows.length === 0) return;
    setImportLoading(true);
    try {
      const res = await fetch("/api/stock-issue-items/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsedRows),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed.");
      toast.success(`Imported ${data.count} item(s) successfully.`);
      setParsedRows([]); setImportFile(null);
      onClose(); onImportComplete();
    } catch (err: any) { toast.error(err.message); }
    finally { setImportLoading(false); }
  };

  const clearStaged = () => { setImportFile(null); setParsedRows([]); };

  const handleClose = () => {
    if (importLoading) return;
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="max-w-4xl"
      rounded="rounded-3xl"
      className="flex flex-col max-h-[90vh]"
    >
      <div className="p-5 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center bg-slate-50/50 dark:bg-gray-800/50">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Import Stock Issue Items
          </h2>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">From .xlsx, .xls, or .csv</p>
        </div>
        <button onClick={handleClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-gray-800 text-slate-400 rounded-full cursor-pointer transition-all">
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 overflow-y-auto space-y-6 flex-1">
        <div className="bg-slate-50 dark:bg-gray-800/50 border border-slate-100 dark:border-gray-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest block">Columns expected</span>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-mono">{IMPORT_COLUMNS.join(" | ")}</p>
          </div>
          <button onClick={downloadExcelTemplate} className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-150/40 dark:border-indigo-800/40 shadow-sm flex items-center gap-1 cursor-pointer shrink-0 transition-all">
            <Download className="w-3.5 h-3.5" /> Download Template
          </button>
        </div>

        {!importFile && (
          <div onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 dark:border-gray-700 hover:border-indigo-500 bg-slate-50/20 dark:bg-gray-800/20 rounded-2xl p-10 text-center space-y-3 cursor-pointer transition-all">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx,.xls,.csv" className="hidden" />
            <CloudUpload className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700 dark:text-gray-300">Drop file here, or <span className="text-indigo-600 underline">browse</span></p>
            <p className="text-[10px] text-slate-400 font-mono">.xlsx .xls .csv</p>
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> {parsedRows.length} rows ready
              </span>
              <button onClick={clearStaged} className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer">Clear</button>
            </div>
            <div className="border border-slate-100 dark:border-gray-800 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
              <table className="w-full text-[10px]">
                <thead className="bg-slate-50 dark:bg-gray-800 text-slate-400 font-mono font-bold uppercase sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Code</th>
                    <th className="px-2 py-2 text-left">Description</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-2 py-2 text-left">WH</th>
                    <th className="px-2 py-2 text-left">Dept</th>
                    <th className="px-2 py-2 text-left">Campus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {parsedRows.slice(0, 15).map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-gray-800/50 bg-white dark:bg-gray-900">
                      <td className="px-2 py-1.5 font-mono text-slate-500">{r.transactionDate}</td>
                      <td className="px-2 py-1.5 font-mono font-bold text-slate-700 dark:text-gray-200">{r.itemCode}</td>
                      <td className="px-2 py-1.5 text-slate-600 dark:text-gray-300 truncate max-w-[180px]">{r.description}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-slate-700">{r.quantity}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.warehouse}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.department}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.campus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 15 && (
                <div className="text-[10px] text-center text-slate-400 py-2.5 border-t border-slate-100 dark:border-gray-800 bg-slate-50/20">...and {parsedRows.length - 15} more rows</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-gray-800 flex justify-end gap-3 bg-slate-50/30 dark:bg-gray-800/30">
        <button onClick={handleClose} disabled={importLoading}
          className="px-4 py-2 border border-slate-200 dark:border-gray-700 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs cursor-pointer transition-colors">Cancel</button>
        <button onClick={submitImport} disabled={importLoading || parsedRows.length === 0}
          className="px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none">
          {importLoading ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Import {parsedRows.length} items</>
          )}
        </button>
      </div>
    </BaseModal>
  );
}
