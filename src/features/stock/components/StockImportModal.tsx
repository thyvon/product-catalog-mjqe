import React, { useState, useRef } from "react";
import { FileText, Download, CloudUpload, CheckCircle, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import BaseModal from "@/features/shared/components/BaseModal";
import { useToast } from "@/features/shared/components/Toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormLabel } from "@/features/shared/components/FormLabel";

const IMPORT_COLUMNS = [
  "Date", "Code", "Description", "Qty", "UoM", "Unit Price", "Total Amount",
  "Requester", "Campus", "Division", "Department", "Description/ Purpose",
  "Ref.No", "Transaction Type", "Account Code", "Warehouse"
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
      ["2026-06-01", "ITEM-001", "Sample item description", 10, "Pcs", 5.50, 55.00, "Vun Thy", "PP", "Admin", "IT", "Monthly supply", "IO-2026-001", "Issue", "ACC-001", "WH-A"],
      ["2026-06-02", "ITEM-002", "Another sample item", 5, "Box", 12.00, 60.00, "Sokha", "PP", "Finance", "Accounting", "Office use", "IO-2026-002", "Transfer", "ACC-002", "WH-B"],
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
      if (!res.ok) {
        let msg = `HTTP ${res.status} ${res.statusText}`;
        try { const d = await res.json(); if (d.error) msg = d.error; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
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
      size="4xl"
      title="Import Stock Issue Items"
      description="From .xlsx, .xls, or .csv"
      rounded="rounded-3xl"
      className="flex flex-col max-h-[90vh]"
    >

      <div className="p-6 overflow-y-auto space-y-6 flex-1">
        <div className="bg-muted border-border p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <FormLabel variant="mono">Columns expected</FormLabel>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{IMPORT_COLUMNS.join(" | ")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadExcelTemplate}>
            <Download /> Download Template
          </Button>
        </div>

        {!importFile && (
          <div onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-border bg-muted/20 rounded-2xl p-10 text-center space-y-3 cursor-pointer transition-all">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".xlsx,.xls,.csv" className="hidden" />
            <CloudUpload className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-xs font-bold text-foreground">Drop file here, or <span className="text-primary underline">browse</span></p>
            <p className="text-xs text-muted-foreground font-mono">.xlsx .xls .csv</p>
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <FormLabel variant="mono" className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> {parsedRows.length} rows ready
              </FormLabel>
              <Button variant="ghost" size="sm" onClick={clearStaged}>Clear</Button>
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted text-muted-foreground font-mono font-bold uppercase sticky top-0">
                  <TableRow>
                    <TableHead className="px-2 py-2 text-left">Date</TableHead>
                    <TableHead className="px-2 py-2 text-left">Code</TableHead>
                    <TableHead className="px-2 py-2 text-left">Description</TableHead>
                    <TableHead className="px-2 py-2 text-right">Qty</TableHead>
                    <TableHead className="px-2 py-2 text-left">Dept</TableHead>
                    <TableHead className="px-2 py-2 text-left">Campus</TableHead>
                    <TableHead className="px-2 py-2 text-left">WH</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 15).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="px-2 py-1.5 font-mono">{r.transactionDate}</TableCell>
                      <TableCell className="px-2 py-1.5 font-mono font-bold">{r.itemCode}</TableCell>
                      <TableCell className="px-2 py-1.5 truncate max-w-[180px]">{r.description}</TableCell>
                      <TableCell className="px-2 py-1.5 text-right font-mono">{r.quantity}</TableCell>
                      <TableCell className="px-2 py-1.5">{r.department}</TableCell>
                      <TableCell className="px-2 py-1.5">{r.campus}</TableCell>
                      <TableCell className="px-2 py-1.5">{r.warehouse}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedRows.length > 15 && (
                <>
                  <Separator className="my-4" />
                  <div className="text-xs text-center text-muted-foreground py-2.5 bg-muted/20">...and {parsedRows.length - 15} more rows</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <Separator className="my-4" />
      <div className="p-4 flex justify-end gap-3 bg-muted/30">
        <Button variant="outline" onClick={handleClose} disabled={importLoading}>Cancel</Button>
        <Button onClick={submitImport} disabled={importLoading || parsedRows.length === 0}>
          {importLoading ? (
            <><RefreshCw className="animate-spin" /> Uploading...</>
          ) : (
            <><CheckCircle /> Import {parsedRows.length} items</>
          )}
        </Button>
      </div>
    </BaseModal>
  );
}
