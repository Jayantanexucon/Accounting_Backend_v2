import crypto from "node:crypto";
import { getExpenseAuditIdentifierModel } from "../models/ExpenseAuditIdentifier.js";
import { getExpenseAuditTransactionModel } from "../models/ExpenseAuditTransaction.js";

const normalize = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const number = (value) => {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Math.abs(value);
  const text = String(value).trim();
  const directValue = Number(
    text
      .replace(/[₹$€£,\s]/g, "")
      .replace(/[()]/g, "")
      .replace(/(?:CR|DR|CREDIT|DEBIT)$/i, ""),
  );
  if (Number.isFinite(directValue)) return Math.abs(directValue);
  const match = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : 0;
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
};
const getRange = (endingYear) => ({
  $gte: new Date(Number(endingYear) - 1, 3, 1),
  $lt: new Date(Number(endingYear), 3, 1),
});
const actor = (req) => String(req.user?._id || req.user?.id || "");
const sendError = (res, error) => res.status(error.statusCode || 500).json({ status: "error", message: error.message || "Expense audit request failed" });

export const listIdentifiers = async (req, res) => {
  try {
    const Identifier = await getExpenseAuditIdentifierModel();
    const data = await Identifier.find({ companyId: req.params.companyId, active: true }).sort({ name: 1 }).lean();
    return res.json({ status: "success", data, message: "Identifiers loaded" });
  } catch (error) { return sendError(res, error); }
};

export const createIdentifier = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!req.body.companyId || !name) return res.status(400).json({ status: "error", message: "Company and identifier name are required" });
    const Identifier = await getExpenseAuditIdentifierModel();
    const data = await Identifier.create({ companyId: req.body.companyId, name, normalizedName: normalize(name), description: req.body.description || "", createdBy: actor(req), updatedBy: actor(req) });
    return res.status(201).json({ status: "success", data, message: "Identifier created" });
  } catch (error) { return sendError(res, error.code === 11000 ? Object.assign(new Error("This identifier already exists"), { statusCode: 409 }) : error); }
};

export const updateIdentifier = async (req, res) => {
  try {
    const Identifier = await getExpenseAuditIdentifierModel();
    const update = { description: req.body.description || "", updatedBy: actor(req) };
    if (req.body.name?.trim()) { update.name = req.body.name.trim(); update.normalizedName = normalize(update.name); }
    const data = await Identifier.findOneAndUpdate({ _id: req.params.id, companyId: req.body.companyId }, update, { new: true, runValidators: true }).lean();
    if (!data) return res.status(404).json({ status: "error", message: "Identifier not found" });
    return res.json({ status: "success", data, message: "Identifier updated" });
  } catch (error) { return sendError(res, error); }
};

export const deleteIdentifier = async (req, res) => {
  try {
    const Identifier = await getExpenseAuditIdentifierModel();
    const data = await Identifier.findOneAndUpdate({ _id: req.params.id, companyId: req.query.companyId }, { active: false, updatedBy: actor(req) }, { new: true }).lean();
    if (!data) return res.status(404).json({ status: "error", message: "Identifier not found" });
    return res.json({ status: "success", data, message: "Identifier deleted" });
  } catch (error) { return sendError(res, error); }
};

export const uploadTransactions = async (req, res) => {
  try {
    const { companyId, transactions, fileName = "", replaceExistingFile = false } = req.body;
    if (!companyId || !Array.isArray(transactions) || !transactions.length) return res.status(400).json({ status: "error", message: "Company and transaction rows are required" });
    const Identifier = await getExpenseAuditIdentifierModel();
    const Transaction = await getExpenseAuditTransactionModel();
    const identifiers = await Identifier.find({ companyId, active: true }).sort({ normalizedName: -1 }).lean();
    const batchId = crypto.randomUUID();
    const docs = transactions.map((row) => {
      const debitAmount = number(row.debitAmount);
      const creditAmount = number(row.creditAmount);
      const description = String(row.description || "").trim();
      const normalizedDescription = normalize(description);
      const match = identifiers.find((identifier) => identifier.normalizedName && normalizedDescription.includes(identifier.normalizedName));
      return { companyId, transactionDate: new Date(row.transactionDate), description, debitAmount, creditAmount, amount: debitAmount || creditAmount, direction: debitAmount ? "DEBIT" : creditAmount ? "CREDIT" : "", identifierId: match?._id || null, identifierName: match?.name || "", rowNumber: row.rowNumber || null, fileName, importBatchId: batchId, originalRowData: row.originalRowData || null };
    });
    if (docs.some((row) => Number.isNaN(row.transactionDate.getTime()))) return res.status(400).json({ status: "error", message: "Every transaction needs a valid date" });
    if (replaceExistingFile && fileName) await Transaction.deleteMany({ companyId, fileName });
    await Transaction.insertMany(docs);
    return res.status(201).json({ status: "success", data: { importBatchId: batchId, importedCount: docs.length, identifiedCount: docs.filter((row) => row.identifierId).length }, message: `${docs.length} transaction rows imported` });
  } catch (error) { return sendError(res, error); }
};

export const getOverview = async (req, res) => {
  try {
    const endingYear = Number(req.query.financialYearEnding);
    if (!Number.isInteger(endingYear) || endingYear < 2000 || endingYear > 2200) return res.status(400).json({ status: "error", message: "A valid financial year is required" });
    const Transaction = await getExpenseAuditTransactionModel();
    const rows = await Transaction.find({ companyId: req.params.companyId, transactionDate: getRange(endingYear) }).sort({ transactionDate: -1, rowNumber: 1 }).lean();
    const groups = new Map();
    rows.filter((row) => row.identifierId).forEach((row) => {
      const key = String(row.identifierId);
      if (!groups.has(key)) groups.set(key, { identifierId: key, identifierName: row.identifierName, debit: { count: 0, total: 0 }, credit: { count: 0, total: 0 } });
      const group = groups.get(key);
      const bucket = row.direction === "DEBIT" ? group.debit : group.credit;
      bucket.count += 1;
      bucket.total += number(row.amount);
    });
    const identifiedRows = rows.filter((row) => row.identifierId).length;
    const debitTotal = rows.reduce((sum, row) => sum + number(row.debitAmount), 0);
    const creditTotal = rows.reduce((sum, row) => sum + number(row.creditAmount), 0);
    return res.json({ status: "success", data: { groups: [...groups.values()].sort((a, b) => a.identifierName.localeCompare(b.identifierName)), unmatched: rows.filter((row) => !row.identifierId), summary: { totalRows: rows.length, identifiedRows, unmatchedRows: rows.length - identifiedRows, debitTotal, creditTotal, netAmount: creditTotal - debitTotal } }, message: "Expense audit overview loaded" });
  } catch (error) { return sendError(res, error); }
};
