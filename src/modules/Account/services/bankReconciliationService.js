import mongoose from "mongoose";
import { getBankTransactionModel } from "../models/BankTransaction.js";
import { getBankReconciliationAllocationModel } from "../models/BankReconciliationAllocation.js";
import { getPaymentModel } from "../models/Payment.js";
import { getJournalModel } from "../models/Journal.js";
import { getAccountModel } from "../models/Account.js";
import { getJournalLineModel } from "../models/JournalLine.js";
import { getBankLedgerTransactionModel } from "../models/BankLedgerTransaction.js";

/**
 * Normalizes text for comparison (reference, description)
 */
const normalize = (text) => String(text || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const IGNORE_NARRATION_TOKENS = new Set([
  "upi", "neft", "rtgs", "imps", "trf", "trtr", "cr", "dr", "bank", "txn",
  "transfer", "payment", "received", "deposit", "withdrawal",
]);

const normalizeNarration = (text = "") => {
  const cleaned = String(text || "")
    .toLowerCase()
    .replace(/[\/\-_]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && !IGNORE_NARRATION_TOKENS.has(token));
  return {
    normalizedNarration: tokens.join(" "),
    narrationTokens: tokens,
    extractedReferences: tokens.filter((token) => /\d/.test(token) && token.length >= 4),
  };
};

const buildSearchableText = (...parts) =>
  normalizeNarration(parts.filter(Boolean).join(" ")).normalizedNarration;

const tokenSimilarity = (leftTokens = [], rightText = "") => {
  const rightTokens = new Set(normalizeNarration(rightText).narrationTokens);
  if (!leftTokens.length || !rightTokens.size) return 0;
  const matched = leftTokens.filter((token) => rightTokens.has(token));
  return matched.length / Math.max(leftTokens.length, rightTokens.size);
};
const hasStrongTextMatch = (left, right) => {
  const a = normalize(left);
  const b = normalize(right);

  if (!a || !b) return false;
  if (a === b) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return shorter.length >= 8 && longer.includes(shorter);
};

const getAbsoluteAmount = (value) => Math.abs(Number(value || 0));

const getRemainingAmount = (totalAmount, allocatedAmount) =>
  Math.max(0, getAbsoluteAmount(totalAmount) - getAbsoluteAmount(allocatedAmount));

const formatAmount = (value) => Number(value || 0).toFixed(2);

const normalizeTransactionType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (["CR", "CREDIT", "DEPOSIT", "RECEIPT"].includes(normalized)) return "CREDIT";
  if (["DR", "DEBIT", "WITHDRAWAL", "PAYMENT"].includes(normalized)) return "DEBIT";
  return normalized || null;
};

const areTransactionDirectionsCompatible = (bankTx, ledgerTx) => {
  const bankType = normalizeTransactionType(bankTx?.type);
  const ledgerType = normalizeTransactionType(ledgerTx?.transactionType);

  if (!bankType || !ledgerType) return false;

  // Bank statement direction is opposite to book bank-ledger direction:
  // statement CREDIT -> book DEBIT, statement DEBIT -> book CREDIT
  return (
    (bankType === "CREDIT" && ledgerType === "DEBIT") ||
    (bankType === "DEBIT" && ledgerType === "CREDIT")
  );
};

const logReconciliation = (stage, payload = {}) => {
  const shouldLog =
    process.env.RECONCILIATION_DEBUG === "true" ||
    process.env.NODE_ENV !== "production";

  if (!shouldLog) return;
  console.log(`[BRS][${stage}]`, payload);
};

const calculateScore = (bankTx, ledgerTx) => {
  const bankRef = normalize(bankTx.referenceNo || bankTx.reference);
  const ledgerRef = normalize(
    ledgerTx.referenceNo ||
      ledgerTx.bankReference ||
      ledgerTx.paymentReference ||
      ledgerTx.instrumentNo,
  );

  const bankAmount = Math.abs(bankTx.amount);
  const ledgerAmount = Math.abs(ledgerTx.amount);
  const directionsCompatible = areTransactionDirectionsCompatible(bankTx, ledgerTx);

  const bankDate = new Date(bankTx.date || bankTx.transactionDate);
  const ledgerDate = new Date(ledgerTx.date);
  const dateDiffDays = Math.abs(bankDate - ledgerDate) / (1000 * 60 * 60 * 24);

  const reasons = [];
  const failures = [];
  let score = 0;

  if (!directionsCompatible) {
    failures.push(
      `Direction mismatch: bank=${normalizeTransactionType(bankTx.type) || "UNKNOWN"} book=${normalizeTransactionType(ledgerTx.transactionType) || "UNKNOWN"}`
    );
    return {
      score: 0,
      reasons,
      failures,
      facts: {
        bankRef,
        ledgerRef,
        bankAmount: formatAmount(bankAmount),
        ledgerAmount: formatAmount(ledgerAmount),
        dateDiffDays: dateDiffDays.toFixed(0),
        bankDescription: bankTx.description || "",
        ledgerNarration: ledgerTx.narration || "",
        bankType: normalizeTransactionType(bankTx.type),
        ledgerType: normalizeTransactionType(ledgerTx.transactionType),
      },
    };
  }

  const amountMatches = Math.abs(bankAmount - ledgerAmount) < 0.01;
  const sameDate = dateDiffDays < 1;
  const nearDate = dateDiffDays <= 2;
  const bankReferences = [
    bankRef,
    ...(bankTx.extractedReferences || []).map((item) => normalize(item)),
  ].filter(Boolean);
  const ledgerReferences = [
    ledgerRef,
    ...(ledgerTx.reconciliationKeywords || []).map((item) => normalize(item)),
  ].filter(Boolean);
  const referenceMatches =
    bankReferences.length > 0 &&
    ledgerReferences.length > 0 &&
    bankReferences.some((left) =>
      ledgerReferences.some((right) => left === right || (left.length >= 6 && right.includes(left)) || (right.length >= 6 && left.includes(right))),
    );
  const narrationScore = tokenSimilarity(
    bankTx.narrationTokens || normalizeNarration(bankTx.description).narrationTokens,
    `${ledgerTx.searchableText || ""} ${ledgerTx.narration || ""}`,
  );
  const invoiceMatches = /INV[A-Z0-9-]*\d+/i.test(`${bankTx.description || ""} ${bankTx.reference || ""}`)
    && /INV[A-Z0-9-]*\d+/i.test(`${ledgerTx.searchableText || ""} ${ledgerTx.referenceNo || ""}`);
  const partyName = String(ledgerTx.counterpartyName || "").trim();
  const partyMatches = partyName && normalizeNarration(bankTx.description).normalizedNarration.includes(normalizeNarration(partyName).normalizedNarration);

  score += 20;
  reasons.push("Compatible bank/book direction");

  if (referenceMatches) {
    score += 50;
    reasons.push("Exact reference match");
  }
  if (amountMatches) {
    score += 35;
    reasons.push("Exact amount match");
  }
  if (sameDate) {
    score += 20;
    reasons.push("Same date");
  } else if (nearDate) {
    score += 15;
    reasons.push(`Date within ${dateDiffDays.toFixed(0)} day(s)`);
  }
  if (narrationScore >= 0.34) {
    score += Math.round(25 * narrationScore);
    reasons.push("Narration token similarity");
  }
  if (partyMatches) {
    score += 20;
    reasons.push("Party name match");
  }
  if (invoiceMatches) {
    score += 25;
    reasons.push("Invoice number match");
  }

  score = Math.min(100, score);

  if (!amountMatches) {
    failures.push(`Amount mismatch: bank=${formatAmount(bankAmount)} book=${formatAmount(ledgerAmount)}`);
  }
  if (!referenceMatches) {
    failures.push(`Reference mismatch: bank=${bankRef || "EMPTY"} book=${ledgerRef || "EMPTY"}`);
  }
  if (dateDiffDays > 2) {
    failures.push(`Date gap too high: ${dateDiffDays.toFixed(0)} day(s)`);
  }
  if (!hasStrongTextMatch(bankTx.description, ledgerTx.narration)) {
    failures.push("Narration/description is not a strong match");
  }

  return {
    score,
    status: score >= 80 ? "AUTO_MATCHED" : score >= 60 ? "SUGGESTED" : "UNMATCHED",
    reasons,
    failures,
    facts: {
      bankRef,
      ledgerRef,
      bankAmount: formatAmount(bankAmount),
      ledgerAmount: formatAmount(ledgerAmount),
      dateDiffDays: dateDiffDays.toFixed(0),
      bankDescription: bankTx.description || "",
      ledgerNarration: ledgerTx.narration || "",
      bankType: normalizeTransactionType(bankTx.type),
      ledgerType: normalizeTransactionType(ledgerTx.transactionType),
    },
  };
};

const getStatusFromAmounts = (totalAmount, allocatedAmount) => {
  const total = getAbsoluteAmount(totalAmount);
  const allocated = Math.min(total, getAbsoluteAmount(allocatedAmount));

  if (allocated <= 0) return "UNMATCHED";
  if (allocated >= total) return "MATCHED";
  return "PARTIAL";
};

export const BankReconciliationService = {
  areTransactionDirectionsCompatible,
  normalizeTransactionType,
  normalizeNarration,
  buildSearchableText,

  async syncAllocationStatus(bankTransactionId, bankLedgerTransactionId) {
    const BankTransaction = await getBankTransactionModel();
    const BankLedgerTransaction = await getBankLedgerTransactionModel();
    const Allocation = await getBankReconciliationAllocationModel();
    const JournalLine = await getJournalLineModel();

    if (bankTransactionId) {
      const bankTx = await BankTransaction.findById(bankTransactionId).lean();
      if (bankTx) {
        const allocatedAmount = (
          await Allocation.find({ bankTransactionId }).lean()
        ).reduce((sum, item) => sum + Number(item.allocatedAmount || 0), 0);
        const reconciliationStatus = getStatusFromAmounts(bankTx.amount, allocatedAmount);

        await BankTransaction.findByIdAndUpdate(bankTransactionId, {
          allocatedAmount,
          reconciliationStatus,
          isReconciled: reconciliationStatus === "MATCHED",
        });
      }
    }

    if (bankLedgerTransactionId) {
      const ledgerTx = await BankLedgerTransaction.findById(bankLedgerTransactionId).lean();
      if (ledgerTx) {
        const allocatedAmount = (
          await Allocation.find({ bankLedgerTransactionId }).lean()
        ).reduce((sum, item) => sum + Number(item.allocatedAmount || 0), 0);
        const reconciliationStatus = getStatusFromAmounts(ledgerTx.amount, allocatedAmount);

        await BankLedgerTransaction.findByIdAndUpdate(bankLedgerTransactionId, {
          allocatedAmount,
          reconciliationStatus,
          isReconciled: reconciliationStatus === "MATCHED",
        });

        if (ledgerTx.journalLineId) {
          await JournalLine.findByIdAndUpdate(ledgerTx.journalLineId, {
            isReconciled: reconciliationStatus === "MATCHED",
          });
        }
      }
    }
  },

  async ensureBankLedgerTransactionsForJournal(journal, lines, companyId) {
    const BankLedgerTransaction = await getBankLedgerTransactionModel();
    const results = [];

    for (const line of lines) {
      const isBank = await this.isBankLedger(line.accountId, companyId);
      if (!isBank) continue;

      const existing = await BankLedgerTransaction.findOne({
        companyId,
        journalId: journal._id,
        journalLineId: line._id,
      }).lean();

      if (existing) {
        results.push(existing);
        continue;
      }

      const debitAmount = Number(line.debitAmount || 0);
      const creditAmount = Number(line.creditAmount || 0);
      const amount = getAbsoluteAmount(debitAmount - creditAmount);
      if (!amount) continue;

      const ledgerTx = await BankLedgerTransaction.create({
        companyId,
        date: journal.date,
        amount,
        transactionType: debitAmount > creditAmount ? "DEBIT" : "CREDIT",
        referenceNo: journal.referenceNumber || journal.externalDocNo || journal.number || "",
        narration: line.description || journal.narration || "",
        bankReference: journal.bankReference || line.bankReference || "",
        paymentReference: journal.paymentReference || line.paymentReference || journal.referenceNumber || "",
        instrumentNo: journal.instrumentNo || line.instrumentNo || "",
        transactionMode: journal.transactionMode || line.transactionMode || journal.voucherType || "",
        counterpartyName: journal.counterpartyName || line.counterpartyName || journal.partyName || "",
        reconciliationKeywords: [
          ...(journal.reconciliationKeywords || []),
          ...(line.reconciliationKeywords || []),
          journal.referenceNumber,
          journal.externalDocNo,
          journal.partyName,
          line.description,
          line.accountName,
        ].filter(Boolean),
        searchableText: buildSearchableText(
          journal.searchableText,
          line.searchableText,
          journal.number,
          journal.referenceNumber,
          journal.externalDocNo,
          journal.narration,
          journal.partyName,
          line.description,
          line.accountName,
        ),
        bankLedgerId: line.accountId,
        journalId: journal._id,
        journalLineId: line._id,
        createdBy: journal.createdBy || null,
      });

      results.push(ledgerTx.toObject ? ledgerTx.toObject() : ledgerTx);
    }

    return results;
  },

  /**
   * Automatically reconciles an accounting entry (Journal or Payment)
   * Triggered by post-save hooks
   */
  async autoReconcile(ledgerTxId) {
    const BankLedgerTransaction = await getBankLedgerTransactionModel();
    const BankTransaction = await getBankTransactionModel();
    const Allocation = await getBankReconciliationAllocationModel();

    const ledgerTx = await BankLedgerTransaction.findById(ledgerTxId).lean();
    if (!ledgerTx || ledgerTx.isReconciled) {
      logReconciliation("SKIP_LEDGER", {
        ledgerTxId,
        reason: !ledgerTx ? "Ledger transaction not found" : "Ledger transaction already reconciled",
      });
      return null;
    }

    const { companyId, bankLedgerId } = ledgerTx;
    logReconciliation("START_AUTO", {
      ledgerTxId: String(ledgerTx._id),
      bankLedgerId: String(bankLedgerId),
      amount: formatAmount(ledgerTx.amount),
      reference: ledgerTx.referenceNo || "",
      narration: ledgerTx.narration || "",
      date: ledgerTx.date,
    });

    // Fetch candidate bank transactions for this ledger that are not yet fully matched
    const candidates = await BankTransaction.find({
      companyId,
      bankLedgerId,
      reconciliationStatus: { $ne: "MATCHED" },
    }).lean();
    logReconciliation("CANDIDATES_FOUND", {
      ledgerTxId: String(ledgerTx._id),
      candidateCount: candidates.length,
    });

    let bestMatch = null;
    let highestScore = 0;
    let bestEvaluation = null;

    for (const bankTx of candidates) {
      const evaluation = calculateScore(bankTx, ledgerTx);
      logReconciliation("CANDIDATE_EVALUATED", {
        ledgerTxId: String(ledgerTx._id),
        bankTransactionId: String(bankTx._id),
        bankReference: bankTx.referenceNo || bankTx.reference || "",
        bankDescription: bankTx.description || "",
        bankAmount: formatAmount(bankTx.amount),
        bankDate: bankTx.date || bankTx.transactionDate,
        score: evaluation.score,
        reasons: evaluation.reasons,
        failures: evaluation.failures,
        facts: evaluation.facts,
      });

      if (evaluation.score > highestScore) {
        highestScore = evaluation.score;
        bestMatch = bankTx;
        bestEvaluation = evaluation;
      }
    }

    logReconciliation("BEST_CANDIDATE", {
      ledgerTxId: String(ledgerTx._id),
      bestBankTransactionId: bestMatch ? String(bestMatch._id) : null,
      highestScore,
      reasons: bestEvaluation?.reasons || [],
      failures: bestEvaluation?.failures || [],
    });

    if (highestScore >= 80) {
      // Check remaining amount on bank transaction
      const existingAllocations = await Allocation.find({ bankTransactionId: bestMatch._id }).lean();
      const alreadyAllocated = existingAllocations.reduce((sum, a) => sum + Number(a.allocatedAmount || 0), 0);
      const remainingBankAmount = getRemainingAmount(bestMatch.amount, alreadyAllocated);

      // Check remaining amount on ledger transaction
      const ledgerAllocated = (
        await Allocation.find({ bankLedgerTransactionId: ledgerTxId }).lean()
      ).reduce((sum, a) => sum + Number(a.allocatedAmount || 0), 0);
      const remainingLedgerAmount = getRemainingAmount(ledgerTx.amount, ledgerAllocated);

      const allocationAmount = Math.min(remainingLedgerAmount, remainingBankAmount);
      logReconciliation("ALLOCATION_CHECK", {
        ledgerTxId: String(ledgerTx._id),
        bankTransactionId: String(bestMatch._id),
        remainingBankAmount: formatAmount(remainingBankAmount),
        remainingLedgerAmount: formatAmount(remainingLedgerAmount),
        allocationAmount: formatAmount(allocationAmount),
      });

      if (allocationAmount > 0) {
        const allocation = await Allocation.create({
          companyId,
          bankTransactionId: bestMatch._id,
          bankLedgerTransactionId: ledgerTxId,
          journalId: ledgerTx.journalId,
          allocatedAmount: allocationAmount,
          matchType: "AUTO",
          matchScore: highestScore,
          reasons: [
            `Auto matched with score ${highestScore}`,
            ...(bestEvaluation?.reasons || []),
          ],
        });

        await this.syncAllocationStatus(bestMatch._id, ledgerTxId);
        logReconciliation("AUTO_MATCH_SUCCESS", {
          ledgerTxId: String(ledgerTx._id),
          bankTransactionId: String(bestMatch._id),
          allocationId: String(allocation._id),
          allocationAmount: formatAmount(allocationAmount),
          reasons: bestEvaluation?.reasons || [],
        });

        return allocation;
      }

      logReconciliation("AUTO_MATCH_BLOCKED", {
        ledgerTxId: String(ledgerTx._id),
        bankTransactionId: String(bestMatch._id),
        reason: "Allocation amount resolved to zero",
      });
    }

    if (bestMatch && highestScore >= 60) {
      const suggestions = Array.isArray(bestMatch.matchSuggestions) ? bestMatch.matchSuggestions : [];
      const nextSuggestions = [
        ...suggestions.filter((item) => String(item.paymentId) !== String(ledgerTxId)),
        {
          paymentId: String(ledgerTxId),
          score: highestScore,
          matchType: "POTENTIAL",
          reasons: bestEvaluation?.reasons || [],
        },
      ]
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 5);

      await BankTransaction.findByIdAndUpdate(bestMatch._id, {
        matchSuggestions: nextSuggestions,
      });
    }

    logReconciliation("AUTO_MATCH_FAILED", {
      ledgerTxId: String(ledgerTx._id),
      reason: highestScore < 80 ? "No candidate reached auto-match threshold" : "No valid allocation amount",
      highestScore,
      bestBankTransactionId: bestMatch ? String(bestMatch._id) : null,
      reasons: bestEvaluation?.reasons || [],
      failures: bestEvaluation?.failures || [],
    });

    return null;
  },

  /**
   * Flow 2: Process Journal and extract Bank Ledger Transactions
   */
  async processJournalForReconciliation(journal, lines, companyId) {
    const results = await this.ensureBankLedgerTransactionsForJournal(journal, lines, companyId);

    for (const ledgerTx of results) {
      await this.autoReconcile(ledgerTx._id);
    }

    return results;
  },

  async ensureBankLedgerTransactionsForAccount(companyId, bankLedgerId) {
    const Journal = await getJournalModel();
    const JournalLine = await getJournalLineModel();

    const bankLines = await JournalLine.find({ companyId, accountId: bankLedgerId })
      .sort({ createdAt: 1 })
      .lean();

    if (!bankLines.length) return [];

    const journalIds = [...new Set(bankLines.map((line) => String(line.journalId)).filter(Boolean))];
    const journals = await Journal.find({
      _id: { $in: journalIds },
      companyId,
      isDeleted: { $ne: true },
      status: { $in: ["Posted", "Approved"] },
    }).lean();

    const linesByJournalId = new Map();
    bankLines.forEach((line) => {
      const key = String(line.journalId);
      if (!linesByJournalId.has(key)) linesByJournalId.set(key, []);
      linesByJournalId.get(key).push(line);
    });

    const results = [];
    for (const journal of journals) {
      const lines = linesByJournalId.get(String(journal._id)) || [];
      if (!lines.length) continue;
      const ensured = await this.ensureBankLedgerTransactionsForJournal(journal, lines, companyId);
      results.push(...ensured);
    }

    return results;
  },

  async autoReconcileBankLedger(companyId, bankLedgerId) {
    const BankLedgerTransaction = await getBankLedgerTransactionModel();

    await this.ensureBankLedgerTransactionsForAccount(companyId, bankLedgerId);

    const ledgerTransactions = await BankLedgerTransaction.find({
      companyId,
      bankLedgerId,
      reconciliationStatus: { $ne: "MATCHED" },
    })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const allocations = [];
    for (const ledgerTx of ledgerTransactions) {
      const allocation = await this.autoReconcile(ledgerTx._id);
      if (allocation) allocations.push(allocation);
    }

    return allocations;
  },

  /**
   * Helper to identify if a ledger is a Bank ledger
   */
  async isBankLedger(accountId, companyId) {
    const Account = await getAccountModel();
    const account = await Account.findOne({ _id: accountId, companyId }).lean();
    if (!account) return false;

    const groupName = (account.groupName || "").toUpperCase().trim();
    return groupName.includes("BANK");
  },

  /**
   * Flow 12: BRS Calculation
   */
  async getBRSReport(companyId, bankLedgerId) {
    if (!bankLedgerId) {
      return { bookBalance: 0, notInBank: 0, notInBooks: 0, bankBalance: 0, difference: 0 };
    }

    const BankTransaction = await getBankTransactionModel();
    const BankLedgerTransaction = await getBankLedgerTransactionModel();
    const JournalLine = await getJournalLineModel();

    // 1. Balance as per Books (current ledger balance)
    const journalLines = await JournalLine.find({ companyId, accountId: bankLedgerId }).lean();
    const bookBalance = journalLines.reduce((sum, line) => sum + (line.debitAmount || 0) - (line.creditAmount || 0), 0);

    // 2. Add: Not in Bank (Unmatched book entries)
    const notInBankTxs = await BankLedgerTransaction.find({
      companyId,
      bankLedgerId,
      isReconciled: false,
    }).lean();
    const notInBank = notInBankTxs.reduce(
      (sum, tx) => sum + getRemainingAmount(tx.amount, tx.allocatedAmount),
      0
    );

    // 3. Less: Not in Books (Unmatched bank transactions)
    const notInBooksTxs = await BankTransaction.find({
      companyId,
      bankLedgerId,
      reconciliationStatus: "UNMATCHED",
    }).lean();
    const notInBooks = notInBooksTxs.reduce(
      (sum, tx) => sum + getRemainingAmount(tx.amount, tx.allocatedAmount),
      0
    );

    const bankBalance = bookBalance + notInBank - notInBooks;

    return {
      bookBalance,
      notInBank,
      notInBooks,
      bankBalance,
      difference: bankBalance - bookBalance,
    };
  }
};
