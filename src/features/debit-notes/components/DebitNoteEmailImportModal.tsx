import React, { useState, useRef } from "react";
import { FileText, Download, CheckCircle, CloudUpload, Eye, RefreshCw } from "lucide-react";
import BaseModal from "@/features/shared/components/BaseModal";
import { useToast } from "@/features/shared/components/Toast";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormLabel } from "@/features/shared/components/FormLabel";

const IMPORT_COLUMNS = ["Warehouse", "Division", "Department", "Campus", "Receiver Name", "Send To Emails", "CC Emails"];

interface DebitNoteEmailImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function DebitNoteEmailImportModal({ isOpen, onClose, onImportComplete }: DebitNoteEmailImportModalProps) {
  const { toast } = useToast();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadExcelTemplate = async () => {
    const XLSX = await import("xlsx");
    const sampleRows = [
      ["Main WH", "IT Support", "IT", "PP", "vun.thy@example.com;sokha@example.com", "cc@example.com"],
      ["Secondary WH", "", "Finance", "SR", "sokha@example.com", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Email Configs");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Debit_Note_Email_Configs_Template.xlsx";
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

        const formatted = json.map((row: any) => ({
          warehouse: String(row["Warehouse"] || row["warehouse"] || row["WAREHOUSE"] || "").trim(),
          department: String(row["Department"] || row["department"] || row["DEPARTMENT"] || "").trim(),
          campus: String(row["Campus"] || row["campus"] || row["CAMPUS"] || "").trim(),
          division: String(row["Division"] || row["division"] || row["DIVISION"] || "").trim(),
          receiverName: String(row["Receiver Name"] || row["receiverName"] || row["RECEIVER NAME"] || row["Receiver"] || "").trim(),
          sendToEmail: String(row["Send To Emails"] || row["sendToEmail"] || row["SEND TO EMAILS"] || row["Send To"] || "").trim(),
          ccToEmail: String(row["CC Emails"] || row["ccToEmail"] || row["CC EMAILS"] || row["CC"] || "").trim(),
        }));

        setParsedRows(formatted);
      } catch (err: any) {
        toast.error(err.message || "Failed to parse file.");
        setImportFile(null);
        setParsedRows([]);
      } finally {
        setImportLoading(false);
      }
    };

    if (ext === ".csv") reader.readAsText(file);
    else reader.readAsBinaryString(file);
  };

  const submitImport = async () => {
    if (parsedRows.length === 0) return;
    setImportLoading(true);
    try {
      const res = await fetch("/api/debit-note/emails/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedRows),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status} ${res.statusText}`;
        try { const d = await res.json(); if (d.error) msg = d.error; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      toast.success(`Imported ${data.count} email config(s) successfully.`);
      setParsedRows([]);
      setImportFile(null);
      onClose();
      onImportComplete();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImportLoading(false);
    }
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
      title="Import Email Configs"
      description="From .xlsx, .xls, or .csv"
      rounded="rounded-3xl"
      className="flex flex-col max-h-[90vh]"
    >

      <div className="p-6 overflow-y-auto space-y-6 flex-1">
        <div className="bg-muted border border-border p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <FormLabel variant="mono">Columns expected</FormLabel>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{IMPORT_COLUMNS.join(" | ")}</p>
          </div>
          <Button onClick={downloadExcelTemplate} variant="outline" size="sm">
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
              <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> {parsedRows.length} rows ready
              </span>
              <Button onClick={clearStaged} variant="ghost" size="sm" className="text-destructive hover:text-destructive">Clear</Button>
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              <Table>
                <TableHeader className="font-mono font-bold uppercase sticky top-0">
                  <TableRow>
                    <TableHead className="px-2 py-2 text-left">Warehouse</TableHead>
                    <TableHead className="px-2 py-2 text-left">Division</TableHead>
                    <TableHead className="px-2 py-2 text-left">Dept</TableHead>
                    <TableHead className="px-2 py-2 text-left">Campus</TableHead>
                    <TableHead className="px-2 py-2 text-left">Receiver</TableHead>
                    <TableHead className="px-2 py-2 text-left">Send To</TableHead>
                    <TableHead className="px-2 py-2 text-left">CC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 15).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="px-2 py-1.5 font-mono font-bold text-foreground">{r.warehouse}</TableCell>
                      <TableCell className="px-2 py-1.5 text-muted-foreground">{r.division || "-"}</TableCell>
                      <TableCell className="px-2 py-1.5 text-muted-foreground">{r.department}</TableCell>
                      <TableCell className="px-2 py-1.5 text-muted-foreground">{r.campus}</TableCell>
                      <TableCell className="px-2 py-1.5 text-muted-foreground">{r.receiverName}</TableCell>
                      <TableCell className="px-2 py-1.5 text-muted-foreground truncate max-w-[160px]">{r.sendToEmail}</TableCell>
                      <TableCell className="px-2 py-1.5 text-muted-foreground truncate max-w-[120px]">{r.ccToEmail}</TableCell>
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
        <Button onClick={handleClose} disabled={importLoading} variant="outline">Cancel</Button>
        <Button onClick={submitImport} disabled={importLoading || parsedRows.length === 0}>
          {importLoading ? (
            <><RefreshCw className="animate-spin" /> Uploading...</>
          ) : (
            <><CheckCircle /> Import {parsedRows.length} configs</>
          )}
        </Button>
      </div>
    </BaseModal>
  );
}
