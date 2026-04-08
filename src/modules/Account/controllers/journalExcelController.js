import mongoose from "mongoose";
import multer from "multer";
import XLSX from "xlsx";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import { getAccountsRepo } from "../repos/accountRepo.js";
import { createJournalRepo } from "../repos/journalRepo.js";
import { createMultipleJournalLinesRepo } from "../repos/journalLineRepo.js";

export const journalExcelUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new AppError("Only .xlsx and .xls files are allowed", 400, "journalExcelUploadMiddleware"));
  },
});

const VALID_VOUCHER_TYPES = ["SALES", "PURCHASE", "PAYMENT", "RECEIPT", "CONTRA", "JOURNAL"];

const roundMoney = (value = 0) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const parseDate = (value) => {
  if (!value && value !== 0) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  if (!Number.isNaN(Number(raw))) {
    const serial = Number(raw);
    if (serial > 40000 && serial < 100000) {
      return new Date((serial - 25569) * 86400 * 1000);
    }
  }

  const dmyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    ) {
      return parsed;
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

const parseWorkbookRows = (buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows.map((row, index) => ({ rowNumber: index + 2, ...row }));
};

const pickField = (rawRow, ...aliases) => {
  const normalizedRow = {};
  Object.keys(rawRow || {}).forEach((key) => {
    normalizedRow[normalizeHeader(key)] = rawRow[key];
  });

  for (const alias of aliases) {
    const value = normalizedRow[normalizeHeader(alias)];
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return "";
};

const normalizeVoucherType = (value = "") => {
  const normalized = String(value).trim().toUpperCase();
  if (normalized === "JOURNAL ENTRY") return "JOURNAL";
  return normalized;
};

const toStoredVoucherType = (value = "") => {
  const normalized = normalizeVoucherType(value);
  const mapping = {
    JOURNAL: "JOURNAL",
    RECEIPT: "RECEIPT",
    PAYMENT: "PAYMENT",
    CONTRA: "CONTRA",
    SALES: "SALES",
    PURCHASE: "PURCHASE",
  };
  return mapping[normalized] || normalized;
};

const normaliseRow = (rawRow) => ({
  rowNumber: rawRow.rowNumber,
  entryId: String(
    pickField(rawRow, "Entry ID", "EntryID", "entry_id", "JournalID", "Journal ID", "ID") || ""
  ).trim(),
  date: pickField(rawRow, "Date", "Journal Date", "Voucher Date", "date"),
  voucherType: normalizeVoucherType(
    pickField(rawRow, "Voucher Type", "VoucherType", "Type", "voucher_type") || ""
  ),
  narration: String(
    pickField(rawRow, "Narration", "Description", "Remarks", "narration") || ""
  ).trim(),
  accountCode: String(
    pickField(
      rawRow,
      "Account Code",
      "AccountCode",
      "account_code",
      "Ledger Code",
      "Code",
      "Account"
    ) || ""
  ).trim(),
  debit: roundMoney(Number(pickField(rawRow, "Debit", "Dr", "debit")) || 0),
  credit: roundMoney(Number(pickField(rawRow, "Credit", "Cr", "credit")) || 0),
});

const groupRows = (rows) => {
  const grouped = new Map();

  rows.forEach((row) => {
    let key;
    if (row.entryId) {
      key = `ENTRYID::${row.entryId}`;
    } else {
      const parsedDate = parseDate(row.date);
      const dateText = parsedDate
        ? `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`
        : String(row.date || "");
      key = `DATE::${dateText}|TYPE::${row.voucherType}|NAR::${row.narration}`;
    }

    if (!grouped.has(key)) {
      grouped.set(key, { key, rows: [] });
    }
    grouped.get(key).rows.push(row);
  });

  return Array.from(grouped.values());
};

const validateGroup = (group, accountMap) => {
  const { rows } = group;
  const errors = [];
  const lineDetails = [];

  if (rows.length < 2) {
    errors.push("Each journal entry must have at least 2 lines");
  }

  const parsedDate = parseDate(rows[0]?.date);
  if (!parsedDate) {
    errors.push(`Invalid date "${rows[0]?.date}" — expected DD/MM/YYYY, DD-MM-YYYY, or Excel serial`);
  }

  const voucherTypes = [...new Set(rows.map((row) => row.voucherType).filter(Boolean))];
  if (voucherTypes.length > 1) {
    errors.push(`Mixed voucher types within one entry: ${voucherTypes.join(", ")}`);
  }

  const voucherType = voucherTypes[0] || "";
  if (!VALID_VOUCHER_TYPES.includes(voucherType)) {
    errors.push(`Invalid voucher type "${voucherType}". Must be one of: ${VALID_VOUCHER_TYPES.join(", ")}`);
  }

  let totalDebit = 0;
  let totalCredit = 0;

  rows.forEach((row) => {
    const rowErrors = [];
    const account = accountMap.get(row.accountCode);

    if (!row.accountCode) {
      rowErrors.push("Account Code is missing");
    } else if (!account) {
      rowErrors.push(`Account code "${row.accountCode}" not found`);
    }

    if (row.debit === 0 && row.credit === 0) {
      rowErrors.push("Both Debit and Credit are zero — line has no value");
    }

    if (row.debit < 0 || row.credit < 0) {
      rowErrors.push("Debit/Credit cannot be negative");
    }

    totalDebit = roundMoney(totalDebit + row.debit);
    totalCredit = roundMoney(totalCredit + row.credit);

    lineDetails.push({
      rowNumber: row.rowNumber,
      accountCode: row.accountCode,
      accountId: account?._id?.toString() || null,
      accountName: account?.name || row.accountCode,
      debit: row.debit,
      credit: row.credit,
      errors: rowErrors,
      isValid: rowErrors.length === 0,
    });
  });

  if (roundMoney(totalDebit) !== roundMoney(totalCredit)) {
    errors.push(`Unbalanced entry — Total Debit ₹${totalDebit} ≠ Total Credit ₹${totalCredit}`);
  }

  const displayDate = parsedDate
    ? `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`
    : rows[0]?.date;

  return {
    entryKey: group.key,
    entryId: rows[0]?.entryId || null,
    date: displayDate,
    parsedDate,
    voucherType,
    narration: rows[0]?.narration || "",
    lines: lineDetails,
    totalDebit,
    totalCredit,
    isBalanced: roundMoney(totalDebit) === roundMoney(totalCredit),
    errors,
    isValid: errors.length === 0 && lineDetails.every((line) => line.isValid),
  };
};

const generateExcelJournalNumber = (companyId, index) =>
  `EXCEL-${String(companyId).slice(-6).toUpperCase()}-${Date.now()}-${String(index + 1).padStart(3, "0")}`;

export const uploadJournalExcel = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError("Excel file is required", 400, "uploadJournalExcel");
    }

    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new AppError("Invalid company ID", 400, "uploadJournalExcel");
    }

    const rawRows = parseWorkbookRows(req.file.buffer);
    if (!rawRows.length) {
      throw new AppError("The uploaded file is empty or has no data rows", 400, "uploadJournalExcel");
    }

    const normalizedRows = rawRows.map(normaliseRow);
    const accounts = await getAccountsRepo({ companyId });
    const accountMap = new Map(accounts.map((account) => [String(account.code || "").trim(), account]));

    const validatedEntries = groupRows(normalizedRows).map((group) => validateGroup(group, accountMap));
    const validEntries = validatedEntries.filter((entry) => entry.isValid);
    const invalidEntries = validatedEntries.filter((entry) => !entry.isValid);

    res.status(200).json({
      success: true,
      preview: {
        totalRows: rawRows.length,
        totalEntries: validatedEntries.length,
        validCount: validEntries.length,
        invalidCount: invalidEntries.length,
        validEntries,
        invalidEntries,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const confirmJournalExcel = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { validEntries } = req.body;

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      throw new AppError("Invalid company ID", 400, "confirmJournalExcel");
    }

    if (!Array.isArray(validEntries) || validEntries.length === 0) {
      throw new AppError("No valid journal entries provided", 400, "confirmJournalExcel");
    }

    const accounts = await getAccountsRepo({ companyId });
    const accountMap = new Map(accounts.map((account) => [String(account.code || "").trim(), account]));

    const savedJournalIds = [];
    const failedEntries = [];

    for (const [index, entry] of validEntries.entries()) {
      try {
        const totalDebit = roundMoney((entry.lines || []).reduce((sum, line) => sum + Number(line.debit || 0), 0));
        const totalCredit = roundMoney((entry.lines || []).reduce((sum, line) => sum + Number(line.credit || 0), 0));

        if (totalDebit !== totalCredit) {
          failedEntries.push({ entry: entry.entryKey, reason: "Unbalanced on save" });
          continue;
        }

        const parsedDate = parseDate(entry.date);
        if (!parsedDate) {
          failedEntries.push({ entry: entry.entryKey, reason: "Invalid journal date" });
          continue;
        }

        const lines = [];
        let accountMissing = false;

        for (const [lineIndex, line] of (entry.lines || []).entries()) {
          const account =
            accountMap.get(String(line.accountCode || "").trim()) ||
            [...accountMap.values()].find((candidate) => String(candidate._id) === String(line.accountId || ""));

          if (!account?._id) {
            failedEntries.push({
              entry: entry.entryKey,
              reason: `Account "${line.accountCode}" not found`,
            });
            accountMissing = true;
            break;
          }

          lines.push({
            journalId: null,
            accountId: account._id,
            accountCode: account.code,
            accountName: account.name,
            companyId,
            debitAmount: roundMoney(line.debit || 0),
            creditAmount: roundMoney(line.credit || 0),
            lineNumber: line.lineNumber ?? lineIndex + 1,
          });
        }

        if (accountMissing) {
          continue;
        }

        const journal = await createJournalRepo({
          number: generateExcelJournalNumber(companyId, index),
          voucherType: toStoredVoucherType(entry.voucherType),
          date: parsedDate,
          narration: entry.narration || "",
          companyId,
          sourceType: "EXCEL",
          totalDebit,
          totalCredit,
          status: "Posted",
          approvalStatus: "Approved",
          createdBy: req.user?._id,
        });

        await createMultipleJournalLinesRepo(
          lines.map((line) => ({
            ...line,
            journalId: journal._id,
          }))
        );

        await createAuditLog({
          userId: req.user?.id,
          entityType: "Journal",
          entityId: journal._id,
          action: "CREATE",
          changes: {
            journal,
            lines,
            source: "journal_excel_upload",
          },
          companyId,
        });

        savedJournalIds.push(journal._id);
      } catch (error) {
        failedEntries.push({
          entry: entry.entryKey,
          reason: error.message || "Unexpected error",
        });
      }
    }

    res.status(201).json({
      success: true,
      savedCount: savedJournalIds.length,
      failedCount: failedEntries.length,
      failedEntries,
      message:
        savedJournalIds.length === validEntries.length
          ? `All ${savedJournalIds.length} journal entries saved successfully`
          : `${savedJournalIds.length} saved, ${failedEntries.length} failed`,
    });
  } catch (error) {
    next(error);
  }
};
