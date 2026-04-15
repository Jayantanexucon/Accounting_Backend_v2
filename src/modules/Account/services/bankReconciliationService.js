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

/**
 * Calculates match score between a bank transaction and an accounting entry
 * IF reference matches AND amount matches: score = 100
 * ELSE IF amount matches AND date difference <= 2 days: score = 80
 * ELSE IF narration similarity: score = 60
 */
const calculateScore = (bankTx, ledgerTx) => {
  const bankRef = normalize(bankTx.referenceNo || bankTx.reference);
  const ledgerRef = normalize(ledgerTx.referenceNo);

  const bankAmount = Math.abs(bankTx.amount);
  const ledgerAmount = Math.abs(ledgerTx.amount);

  const bankDate = new Date(bankTx.date || bankTx.transactionDate);
  const ledgerDate = new Date(ledgerTx.date);
  const dateDiffDays = Math.abs(bankDate - ledgerDate) / (1000 * 60 * 60 * 24);

  // 1. Reference + Amount match (Score 100)
  if (bankRef && ledgerRef && bankRef === ledgerRef && bankAmount === ledgerAmount) {
    return 100;
  }

  // 2. Amount match + Date proximity (<= 2 days) (Score 80)
  if (bankAmount === ledgerAmount && dateDiffDays <= 2) {
    return 80;
  }

  // 3. Amount match + strong narration similarity (treat as exact for bank-vs-books text matches)
  if (bankAmount === ledgerAmount && hasStrongTextMatch(bankTx.description, ledgerTx.narration)) {
    return 100;
  }

  // 3. Narration similarity (Score 60)
  const bankDesc = normalize(bankTx.description);
  const ledgerNar = normalize(ledgerTx.narration);
  if (bankDesc && ledgerNar && (bankDesc.includes(ledgerNar) || ledgerNar.includes(bankDesc))) {
    return 60;
  }

  return 0;
};

const getStatusFromAmounts = (totalAmount, allocatedAmount) => {
  const total = getAbsoluteAmount(totalAmount);
  const allocated = Math.min(total, getAbsoluteAmount(allocatedAmount));

  if (allocated <= 0) return "UNMATCHED";
  if (allocated >= total) return "MATCHED";
  return "PARTIAL";
};

export const BankReconciliationService = {
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
    if (!ledgerTx || ledgerTx.isReconciled) return null;

    const { companyId, bankLedgerId } = ledgerTx;

    // Fetch candidate bank transactions for this ledger that are not yet fully matched
    const candidates = await BankTransaction.find({
      companyId,
      bankLedgerId,
      reconciliationStatus: { $ne: "MATCHED" },
    }).lean();

    let bestMatch = null;
    let highestScore = 0;

    for (const bankTx of candidates) {
      const score = calculateScore(bankTx, ledgerTx);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = bankTx;
      }
    }

    // AUTO MATCH decision (Score >= 100 as per CORE PRINCIPLE Flow 5)
    if (highestScore >= 100) {
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

      if (allocationAmount > 0) {
        const allocation = await Allocation.create({
          companyId,
          bankTransactionId: bestMatch._id,
          bankLedgerTransactionId: ledgerTxId,
          journalId: ledgerTx.journalId,
          allocatedAmount: allocationAmount,
          matchType: "AUTO",
          matchScore: highestScore,
          reasons: [`Auto matched with score ${highestScore}`],
        });

        await this.syncAllocationStatus(bestMatch._id, ledgerTxId);

        return allocation;
      }
    }

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
