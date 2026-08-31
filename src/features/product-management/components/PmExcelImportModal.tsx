import React, { useState, useRef } from "react";
import {
  Download,
  CheckCircle,
  CloudUpload,
  Eye,
  RefreshCw as Refresh,
} from "lucide-react";
import BaseModal from "@/features/shared/components/BaseModal";
import { useToast } from "@/features/shared/components/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormLabel } from "@/features/shared/components/FormLabel";
import SelectField from "@/features/shared/components/SelectField";
import { pmImportFile } from "@/features/product-management/api";

interface PmExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedRow {
  code: string;
  name: string;
  group: string;
  type: string;
  brand: string;
  uom: string;
  subUnit: string;
  status: string;
}

type TemplateKind = "standard" | "variable";

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

export default function PmExcelImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: PmExcelImportModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [templateKind, setTemplateKind] = useState<TemplateKind>("standard");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const downloadExcelTemplate = async () => {
    try {
      const endpoint = templateKind === "variable"
        ? "/api/pm/products/import/template/variable"
        : "/api/pm/products/import/template";
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to download template.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = templateKind === "variable" ? "VariableProductImportTemplate.xlsx" : "ProductImportTemplate.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || "Failed to download template.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  const processFile = async (selectedFile: File) => {
    const XLSX = await import("xlsx");
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error("Invalid file format. Please upload a spreadsheet file (.xlsx, .xls or .csv).");
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let workbook;

        if (ext === ".csv") {
          workbook = XLSX.read(data, { type: "string" });
        } else {
          workbook = XLSX.read(data, { type: "binary" });
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          throw new Error("No parsed data recognized inside this spreadsheet.");
        }

        const formatted = rawJson.map((row: any) => {
          const codeVal = row["Code"] || row["code"] || row["Product Code"] || row["ProductCode"] || row["sku"] || row["SKU"];
          const nameVal = row["Name"] || row["name"] || row["Product Name"] || row["ProductName"];
          const groupVal = row["Group"] || row["group"] || row["Group Code"] || row["Product Group"] || row["product_group"];
          const typeVal = String(row["Type"] || row["type"] || "single").toLowerCase();
          const brandVal = row["Brand"] || row["brand"] || row["Brand Code"] || row["brand_code"];
          const uomVal = row["UoM"] || row["UOM"] || row["uom"] || row["Unit"] || row["unit"];
          const subUnitVal = row["Sub Unit"] || row["Sub-Unit"] || row["sub_unit"] || row["subUnit"] || "";
          const statusVal = row["Status"] || row["status"] || "Active";

          return {
            code: codeVal ? String(codeVal).toUpperCase().trim() : "",
            name: nameVal ? String(nameVal).trim() : "",
            group: groupVal ? String(groupVal).trim() : "",
            type: typeVal === "variation" ? "variation" : "single",
            brand: brandVal ? String(brandVal).trim() : "",
            uom: uomVal ? String(uomVal).trim() : "",
            subUnit: subUnitVal ? String(subUnitVal).trim() : "",
            status: statusVal === "Inactive" ? "Inactive" : "Active",
          };
        });

        const validatedRows = formatted.filter((r) => r.code && r.name);

        if (validatedRows.length === 0) {
          throw new Error("Could not detect any rows with 'Code' and 'Name'. Please download our template to see formatting!");
        }

        setParsedRows(validatedRows);
      } catch (err: any) {
        console.error("Excel format error:", err);
        toast.error(err.message || "Unable to extract items from your spreadsheet.");
        setFile(null);
        setParsedRows([]);
      } finally {
        setLoading(false);
      }
    };

    if (ext === ".csv") {
      reader.readAsText(selectedFile);
    } else {
      reader.readAsBinaryString(selectedFile);
    }
  };

  const triggerImportSubmit = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const base64 = await readFileAsBase64(file);
      const data = await pmImportFile(file.name, base64);

      if (data.errors && data.errors.length > 0) {
        const preview = data.errors.slice(0, 5).join(" ").slice(0, 240);
        toast.warning(
          `Imported ${data.imported}, skipped ${data.skipped}. ${preview}${data.errors.length > 5 ? ` (+${data.errors.length - 5} more)` : ""}`
        );
      } else {
        toast.success(`Successfully imported ${data.imported} product(s).`);
      }
      setParsedRows([]);
      setFile(null);
      onImportComplete();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An unexpected error occurred uploading batch entries.");
    } finally {
      setLoading(false);
    }
  };

  const clearStagedFile = () => {
    setFile(null);
    setParsedRows([]);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      title="Import Products from Excel or CSV"
      description="Bulk register products from .xlsx, .xls or .csv files"
      maxHeight="max-h-[88vh]"
      rounded="rounded-3xl"
      backdropBlur="backdrop-blur-md"
      className="flex flex-col overflow-hidden"
    >
      <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
        {/* __GUIDE__ */}
        <div className="bg-muted border border-border p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <FormLabel variant="mono">Column Specification Standard</FormLabel>
            <div className="flex flex-wrap items-center gap-3">
              <SelectField
                value={templateKind}
                onChange={(v) => setTemplateKind(v as TemplateKind)}
                containerClassName="min-w-[220px]"
                options={[
                  { value: "standard", label: "Standard Product Template" },
                  { value: "variable", label: "Variable Product Template" },
                ]}
              />
              <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
                {templateKind === "variable" ? (
                  <>
                    Required headers: <strong className="text-foreground">Code</strong>,{" "}
                    <strong className="text-foreground">Name</strong>,{" "}
                    <strong className="text-foreground">Variation Name</strong>, and{" "}
                    <strong className="text-foreground">Variation Values</strong>. Optional:{" "}
                    <strong className="text-foreground">Group</strong>,{" "}
                    <strong className="text-foreground">Brand</strong>,{" "}
                    <strong className="text-foreground">UoM</strong>,{" "}
                    <strong className="text-foreground">Sub Unit</strong>,{" "}
                    <strong className="text-foreground">Variation Templates</strong>,{" "}
                    <strong className="text-foreground">Description</strong>, and{" "}
                    <strong className="text-foreground">Status</strong>. Repeat rows to add more variations.
                  </>
                ) : (
                  <>
                    Required headers: <strong className="text-foreground">Code</strong> and{" "}
                    <strong className="text-foreground">Name</strong>. Optional:{" "}
                    <strong className="text-foreground">Type</strong> (single/variation),{" "}
                    <strong className="text-foreground">SKU</strong>,{" "}
                    <strong className="text-foreground">Group</strong>,{" "}
                    <strong className="text-foreground">Brand</strong>,{" "}
                    <strong className="text-foreground">UoM</strong>,{" "}
                    <strong className="text-foreground">Sub Unit</strong>,{" "}
                    <strong className="text-foreground">Description</strong>, and{" "}
                    <strong className="text-foreground">Status</strong>. Rows with an existing code update the product and its default variant.
                  </>
                )}
              </p>
            </div>
          </div>

          <Button id="btn-download-pm-excel-template" onClick={downloadExcelTemplate} variant="outline" size="sm">
            <Download /> Download Template (.xlsx)
          </Button>
        </div>

        {!file && (
          <div
            id="pm-excel-dropzone"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-border bg-muted/20 hover:bg-muted p-10 rounded-2xl text-center space-y-3 cursor-pointer transition-all"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
              <CloudUpload className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                Drag and drop your spreadsheet here, or <span className="text-primary underline">browse</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                Supports Microsoft Excel (.xlsx, .xls) and raw Comma Separated (.csv) files
              </p>
            </div>
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <FormLabel variant="mono" className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> Staging Spreadsheet Preview ({parsedRows.length} valid rows detected)
              </FormLabel>
              <Button
                id="btn-remove-pm-file"
                onClick={clearStagedFile}
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                Clear Spreadsheet
              </Button>
            </div>

            <div className="max-h-[220px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted text-muted-foreground font-mono tracking-wider font-bold uppercase sticky top-0">
                  <TableRow>
                    <TableHead className="px-3.5 py-2 w-1/5">Code</TableHead>
                    <TableHead className="px-3.5 py-2 w-1/3">Name</TableHead>
                    <TableHead className="px-3 py-2">Group</TableHead>
                    <TableHead className="px-3 py-2">Brand</TableHead>
                    <TableHead className="px-3 py-2">Type</TableHead>
                    <TableHead className="px-3 py-2">UoM</TableHead>
                    <TableHead className="px-3 py-2">Sub-Unit</TableHead>
                    <TableHead className="px-3 py-2">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 15).map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="px-3.5 py-1.5 font-bold font-mono uppercase tracking-wide">
                        {row.code}
                      </TableCell>
                      <TableCell className="px-3.5 py-1.5 line-clamp-1 truncate font-medium">
                        {row.name}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 font-bold font-mono">
                        {row.group || "—"}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 font-medium">
                        {row.brand || "—"}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 font-medium">
                        {row.type === "variation" ? "Variation" : "Single"}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 font-mono text-xs">
                        {row.uom || "—"}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 font-mono text-xs">
                        {row.subUnit || "—"}
                      </TableCell>
                      <TableCell className="px-3 py-1.5">
                        <Badge variant={row.status === "Active" ? "default" : "secondary"} className="text-xs font-medium">
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedRows.length > 15 && (
                <>
                  <Separator className="my-4" />
                  <div className="text-xs text-center text-muted-foreground py-2.5 font-mono bg-muted/20">
                    ...and {parsedRows.length - 15} additional rows ready in staging buffer
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <Separator className="my-4" />
      <div className="p-4 flex justify-end gap-3 bg-muted/30 shrink-0">
        {/* __FOOTER__ */}
        <Button id="pm-import-cancel-btn" onClick={onClose} disabled={loading} variant="outline">
          Cancel
        </Button>
        <Button
          id="pm-import-finalize-btn"
          onClick={triggerImportSubmit}
          disabled={loading || !file}
        >
          {loading ? (
            <>
              <Refresh className="animate-spin" />
              Finalizing upload ingestion...
            </>
          ) : (
            <>
              <CheckCircle />
              Finalize and Upload {parsedRows.length > 0 ? `${parsedRows.length} items` : "file"}
            </>
          )}
        </Button>
      </div>
    </BaseModal>
  );
}