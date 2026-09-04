import ExcelJS from "exceljs";
import { ensureDebitNoteLogo, getDebitNoteLogo } from "./logo.js";

function toDateOnly(s: any): Date | null {
  if (!s) return null;
  const dt = typeof s === "string" ? new Date(s + "T00:00:00") : new Date(s);
  if (isNaN(dt.getTime())) return null;
  return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
}

export function buildDebitNoteSheet(workbook: ExcelJS.Workbook, note: any, items: any[], preparedBy?: { name: string; position: string; phone?: string; email?: string }) {
  const sheet = workbook.addWorksheet("Debit Note");
  const COL_COUNT = 14;

  [5, 14, 16, 45, 8, 7, 14, 16, 18, 12, 14, 14, 16, 40]
    .forEach((w, i) => sheet.getColumn(i + 1).width = w);

  ensureDebitNoteLogo();
  const debitNoteLogo = getDebitNoteLogo();
  if (debitNoteLogo) {
    const imageId = workbook.addImage({ base64: debitNoteLogo.base64, extension: "png" });
    sheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: debitNoteLogo.width, height: debitNoteLogo.height },
    });
  }

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" }, left: { style: "thin" },
    bottom: { style: "thin" }, right: { style: "thin" },
  };

  sheet.mergeCells(1, 1, 1, COL_COUNT);
  const titleCell = sheet.getCell("A1");
  titleCell.value = "DEBIT NOTE";
  titleCell.font = { name: "TW CEN MT", bold: true, size: 16, color: { argb: "FF1F4E79" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells(2, 1, 2, COL_COUNT);
  const infoCell = sheet.getCell("A2");
  const fmtDate = (s: any) => {
    const dt = toDateOnly(s);
    if (!dt) return "";
    return dt.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "2-digit", year: "numeric" });
  };
  infoCell.value = `${note.division || ""} - ${note.department || ""} - ${note.campus || ""}  |  ${fmtDate(note.startDate)} to ${fmtDate(note.endDate)}`;
  infoCell.font = { name: "TW CEN MT", size: 10, color: { argb: "FF777777" } };
  infoCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 18;

  const headers = ["No", "Date", "Code", "Item Name", "Qty", "UoM", "U/Price", "Amount", "Requester", "Campus", "Division", "Department", "IO Number", "Remarks"];
  const headerRow = sheet.getRow(4);
  headerRow.height = 22;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "TW CEN MT", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E75B6" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });

  let rowIdx = 5;
  for (const item of items) {
    const row = sheet.getRow(rowIdx);
    row.getCell(1).value = rowIdx - 4;
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    const d = item.transactionDate;
    if (d) {
      const dt = toDateOnly(d);
      row.getCell(2).value = dt ?? "";
      row.getCell(2).numFmt = 'mmm dd, yyyy';
    } else {
      row.getCell(2).value = "";
    }
    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).value = item.itemCode || "";
    row.getCell(3).alignment = { vertical: "middle" };
    row.getCell(4).value = item.description || "";
    row.getCell(4).alignment = { vertical: "middle", wrapText: true };
    row.getCell(5).value = parseFloat(item.quantity) || 0;
    row.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(5).numFmt = '0.00';
    row.getCell(6).value = item.uom || "";
    row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(7).value = parseFloat(item.unitPrice) || 0;
    row.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(7).numFmt = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
    row.getCell(8).value = parseFloat(item.totalPrice) || 0;
    row.getCell(8).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(8).numFmt = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
    row.getCell(9).value = item.requesterName || "";
    row.getCell(9).alignment = { vertical: "middle" };
    row.getCell(10).value = item.campus || "";
    row.getCell(10).alignment = { vertical: "middle" };
    row.getCell(11).value = item.division || "";
    row.getCell(11).alignment = { vertical: "middle" };
    row.getCell(12).value = item.department || "";
    row.getCell(12).alignment = { vertical: "middle" };
    row.getCell(13).value = item.referenceNo || "";
    row.getCell(13).alignment = { vertical: "middle" };
    row.getCell(14).value = item.remarks || "";
    row.getCell(14).alignment = { vertical: "middle", wrapText: true };

    for (let c = 1; c <= COL_COUNT; c++) {
      const cell = row.getCell(c);
      if (!cell.font?.name) cell.font = { name: "TW CEN MT", size: 10 };
      cell.border = thinBorder;
      if (rowIdx % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F7FB" } };
      }
    }
    rowIdx++;
  }

  const totalRow = sheet.getRow(rowIdx);
  totalRow.height = 22;
  totalRow.getCell(7).value = "TOTAL:";
  totalRow.getCell(7).font = { name: "TW CEN MT", bold: true, size: 11 };
  totalRow.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
  const totalAmtCell = totalRow.getCell(8);
  totalAmtCell.value = { formula: `SUM(H5:H${rowIdx - 1})` };
  totalAmtCell.font = { name: "TW CEN MT", bold: true, size: 11 };
  totalAmtCell.alignment = { horizontal: "right", vertical: "middle" };
  totalAmtCell.numFmt = '$#,##0.00';

  for (let c = 1; c <= COL_COUNT; c++) {
    const cell = totalRow.getCell(c);
    cell.border = {
      top: { style: "double" }, left: { style: "thin" },
      bottom: { style: "double" }, right: { style: "thin" },
    };
  }

  rowIdx += 2;
  const endDateStr = fmtDate(note.endDate);
  const footerData = [
    ["Prepared by:", preparedBy?.name || note.createdBy || ""],
    ["Position:", preparedBy?.position || ""],
    ["Phone:", preparedBy?.phone || ""],
    ["Email:", preparedBy?.email || ""],
    ["Date:", endDateStr],
  ];
  footerData.forEach(([label, value]) => {
    const row = sheet.getRow(rowIdx);
    sheet.mergeCells(rowIdx, 1, rowIdx, 2);
    row.getCell(1).value = label;
    row.getCell(1).font = { name: "TW CEN MT", bold: true, size: 10 };
    row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    row.getCell(3).value = value;
    row.getCell(3).font = { name: "TW CEN MT", size: 10 };
    row.getCell(3).alignment = { vertical: "middle" };
    row.height = 18;
    rowIdx++;
  });

  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.margins = {
    top: 0.5, right: 0.5, bottom: 0.5, left: 0.5,
    header: 0.3, footer: 0.3,
  };
}
