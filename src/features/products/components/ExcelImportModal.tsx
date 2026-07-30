import React, { useState, useRef } from "react";
import {
  FileText,
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

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: ExcelImportModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Generate a fully compliant Excel (.xlsx) template file client-side
  const downloadExcelTemplate = async () => {
    const XLSX = await import("xlsx");
    // Column Headers matching the required fields
    const headers = [
      "Product Code",
      "Product Name",
      "UoM",
      "Category",
      "Sub Category",
      "Status",
      "Price (Optional)",
      "Stock (Optional)"
    ];

    // Some actual starting sample catalog rows
    const sampleRows = [
      [
        "PROD-EL-901",
        "AeroListen Silent Headphones XL",
        "Pcs",
        "Electronics",
        "Audio Gear",
        "Active",
        "199.99",
        "50"
      ],
      [
        "PROD-HL-055",
        "ThermaKeep Intelligent Thermos",
        "Box",
        "Home & Lifestyle",
        "Smart Kitchen",
        "Active",
        "24.50",
        "120"
      ],
      [
        "PROD-OT-211",
        "GelGrip Solid Ink Pen 0.7mm",
        "Doz",
        "Office Tools",
        "Pens",
        "Inactive",
        "12.00",
        "0"
      ]
    ];

    const worksheetData = [headers, ...sampleRows];
    
    // Build actual SheetJS workbook
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Catalog Template");

    // Write binary container & trigger download
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "Catalog_Import_Template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setSuccessCount(null);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSuccessCount(null);
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  // Parse Excel / CSV files client side
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
        
        // Convert to array of objects
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          throw new Error("No parsed data recognized inside this spreadsheet.");
        }

        // Standardize column keys mapping
        const formatted = rawJson.map((row: any) => {
          // Normalize matching values
          const codeVal = row["Product Code"] || row["ProductCode"] || row["Code"] || row["productCode"] || row["PRODUCT CODE"];
          const nameVal = row["Product Name"] || row["ProductName"] || row["Name"] || row["productName"] || row["PRODUCT NAME"] || row["Product Name/Description"];
          const descriptionVal = row["Description"] || row["description"] || row["Product Name/Description"] || "";
          const uomVal = row["UoM"] || row["UOM"] || row["uom"] || row["Unit"] || "Pcs";
          const catVal = row["Category"] || row["category"] || row["CATEGORY"] || "General";
          const subCatVal = row["Sub Category"] || row["SubCategory"] || row["subcategory"] || "";
          const statusVal = row["Status"] || row["status"] || "Active";
          
          const priceVal = row["Price"] || row["price"] || row["Price (Optional)"] || undefined;
          const stockVal = row["Stock"] || row["stock"] || row["Stock (Optional)"] || undefined;

          return {
            productCode: codeVal ? String(codeVal).toUpperCase().trim() : "",
            name: nameVal ? String(nameVal).trim() : "",
            description: descriptionVal ? String(descriptionVal).trim() : (nameVal ? String(nameVal).trim() : ""),
            uom: uomVal ? String(uomVal).trim() : "Pcs",
            category: catVal ? String(catVal).trim() : "General",
            subCategory: subCatVal ? String(subCatVal).trim() : "General",
            status: ["Active", "Inactive"].includes(statusVal) ? statusVal : "Active",
            price: priceVal ? parseFloat(priceVal) : undefined,
            stock: stockVal ? parseInt(stockVal, 10) : undefined,
          };
        });

        // Basic sanity check: Is there a Product Code and Name on rows?
        const validatedRows = formatted.filter(r => r.productCode && r.name);
        
        if (validatedRows.length === 0) {
          throw new Error("Could not detect any rows matching headers 'Product Code' and 'Product Name'. Please download our template to see formatting!");
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

  // Submit batch payload to backend
  const triggerImportSubmit = async () => {
    if (parsedRows.length === 0) return;

    setLoading(true);

    try {
      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedRows),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to commit spreadsheet upload.");
      }

      toast.success(`Successfully imported ${data.count} product(s).`);
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
    setSuccessCount(null);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      title="Import Catalog from Excel or CSV"
      description="Bulk register, update, and manage products from .xlsx, .xls or .csv files"
      maxHeight="max-h-[88vh]"
      rounded="rounded-3xl"
      backdropBlur="backdrop-blur-md"
      className="flex flex-col overflow-hidden"
    >

      <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
        {/* Guide & Template download */}
        <div className="bg-muted border border-border p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <FormLabel variant="mono">Column Specification Standard</FormLabel>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
              Ensure headers contain: <strong className="text-foreground">Product Code</strong>, <strong className="text-foreground">Product Name</strong>, <strong className="text-foreground">UoM</strong>, <strong className="text-foreground">Category</strong>, <strong className="text-foreground">Sub Category</strong>, and <strong className="text-foreground">Status</strong>.
            </p>
          </div>

          <Button
            id="btn-download-excel-template"
            onClick={downloadExcelTemplate}
            variant="outline"
            size="sm"
          >
            <Download /> Download Template (.xlsx)
          </Button>
        </div>

        {/* File Drag-and-drop zone */}
        {!file && successCount === null && (
          <div
            id="excel-dropzone"
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
            <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto group-hover:text-foreground transition-colors">
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

        {/* Ingestion Table preview stage */}
        {parsedRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <FormLabel variant="mono" className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> Staging Spreadsheet Preview ({parsedRows.length} valid rows detected)
              </FormLabel>
              <Button
                id="btn-remove-file"
                onClick={clearStagedFile}
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                Clear Spreadsheet
              </Button>
            </div>

            {/* Staging grid table preview */}
            <div className="max-h-[220px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted text-muted-foreground font-mono tracking-wider font-bold uppercase sticky top-0">
                  <TableRow>
                    <TableHead className="px-3.5 py-2 w-1/5">Code</TableHead>
                    <TableHead className="px-3.5 py-2 w-1/3">Name/Title</TableHead>
                    <TableHead className="px-3 py-2">UoM</TableHead>
                    <TableHead className="px-3 py-2">Category</TableHead>
                    <TableHead className="px-3 py-2">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 15).map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="px-3.5 py-1.5 font-bold font-mono uppercase tracking-wide">
                        {row.productCode}
                      </TableCell>
                      <TableCell className="px-3.5 py-1.5 line-clamp-1 truncate font-medium">
                        {row.name}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 font-bold font-mono">
                        {row.uom}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 font-medium">
                        {row.category}
                      </TableCell>
                      <TableCell className="px-3 py-1.5">
                        <Badge variant={row.status === "Active" ? "default" : row.status === "Inactive" ? "secondary" : "destructive"} className="text-xs font-medium">
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

      {/* Dialog Action buttons */}
      <Separator className="my-4" />
      <div className="p-4 flex justify-end gap-3 bg-muted/30 shrink-0">
        <Button
          id="import-cancel-btn"
          onClick={onClose}
          disabled={loading}
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          id="import-finalize-btn"
          onClick={triggerImportSubmit}
          disabled={loading || parsedRows.length === 0}
        >
          {loading ? (
            <>
              <Refresh className="animate-spin" />
              Finalizing upload ingestion...
            </>
          ) : (
            <>
              <CheckCircle />
              Finalize and Upload {parsedRows.length} items
            </>
          )}
        </Button>
      </div>
    </BaseModal>
  );
}
