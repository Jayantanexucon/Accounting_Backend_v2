import mongoose from "mongoose";
import { getBankTransactionModel } from "../models/BankTransaction.js";
import { getBankReconciliationAllocationModel } from "../models/BankReconciliationAllocation.js";
import { getPaymentModel } from "../models/Payment.js";
import { getJournalModel } from "../models/Journal.js";
import { getAccountModel } from "../models/Account.js";
import { getJournalLineModel } from "../models/JournalLine.js";

/**
 * Normalizes text for comparison (reference, description)
 */
const normalize = (text) => String(text || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Calculates match score between a bank transaction and an accounting entry
 * IF reference matches AND amount matches: score = 100
 * ELSE IF amount matches AND date difference <= 2 days: score = 80
 * ELSE IF narration similarity: score = 60
 */
const calculateScore = (bankTx, entry) => {
  const bankRef = normalize(bankTx.referenceNo || bankTx.reference);
  const entryRef = normalize(entry.referenceNo || entry.reference);

  const bankAmount = Math.abs(bankTx.amount);
  const entryAmount = Math.abs(entry.amount);

  const bankDate = new Date(bankTx.date || bankTx.transactionDate);
  const entryDate = new Date(entry.date || entry.paymentDate);
  const dateDiffDays = Math.abs(bankDate - entryDate) / (1000 * 60 * 60 * 24);

  // 1. Reference + Amount match
  if (bankRef && entryRef && bankRef === entryRef && bankAmount === entryAmount) {
    return 100;
  }

  // 2. Amount match + Date proximity (<= 2 days)
  if (bankAmount === entryAmount && dateDiffDays <= 2) {
    return 80;
  }

  // 3. Narration similarity (Score 60)
  const bankDesc = normalize(bankTx.description);
  const entryNar = normalize(entry.narration || entry.notes || "");
  if (bankDesc && entryNar && (bankDesc.includes(entryNar) || entryNar.includes(bankDesc))) {
    return 60;
  }

  return 0;
};

export const BankReconciliationService = {
  /**
   * Automatically reconciles an accounting entry (Journal or Payment)
   * Triggered by post-save hooks
   */
  async autoReconcile(entryData) {
    const { id, companyId, amount, date, referenceNo, narration, bankLedgerId, type } = entryData;

    if (!bankLedgerId) return null;

    const BankTransaction = await getBankTransactionModel();
    const Allocation = await getBankReconciliationAllocationModel();

    // Fetch candidate bank transactions for this ledger that are not yet fully matched
    const candidates = await BankTransaction.find({
      companyId,
      bankLedgerId,
      reconciliationStatus: { $ne: "MATCHED" },
    }).lean();

    let bestMatch = null;
    let highestScore = 0;

    for (const bankTx of candidates) {
      const score = calculateScore(bankTx, { amount, date, referenceNo, narration });
      if (score > highestScore) {
        highestScore = score;
        bestMatch = bankTx;
      }
    }

    // AUTO MATCH decision
    if (highestScore >= 80) {
      // Check if this bank transaction already has some allocations (partial support)
      const existingAllocations = await Allocation.find({ bankTransactionId: bestMatch._id }).lean();
      const alreadyAllocated = existingAllocations.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
      const remainingBankBalance = Math.abs(bestMatch.amount) - alreadyAllocated;

      const allocationAmount = Math.min(amount, remainingBankBalance);

      if (allocationAmount > 0) {
        const allocation = await Allocation.create({
          companyId,
          bankTransactionId: bestMatch._id,
          [type === "PAYMENT" ? "paymentId" : "journalId"]: id,
          allocatedAmount: allocationAmount,
          matchType: "AUTO",
          matchScore: highestScore,
          reasons: [`Auto matched with score ${highestScore}`],
        });

        // Update BankTransaction status
        const totalAllocated = alreadyAllocated + allocationAmount;
        let status = "PARTIAL";
        if (Math.abs(totalAllocated - Math.abs(bestMatch.amount)) < 0.01) {
          status = "MATCHED";
        }

        await BankTransaction.findByIdAndUpdate(bestMatch._id, {
          reconciliationStatus: status,
          isReconciled: status === "MATCHED",
        });

        // Update Entry status (if payment)
        if (type === "PAYMENT") {
          const Payment = await getPaymentModel();
          await Payment.findByIdAndUpdate(id, {
            isReconciled: true,
            reconciliationStatus: status === "MATCHED" ? "FULLY_RECONCILED" : "PARTIALLY_RECONCILED",
            reconciledAmount: totalAllocated,
          });
        }

        return allocation;
      }
    }

    return null;
  },

  /**
   * Helper to identify if a ledger is a Bank ledger
   */
  async isBankLedger(accountId, companyId) {
    const Account = await getAccountModel();
    const account = await Account.findOne({ _id: accountId, companyId }).lean();
    if (!account) return false;

    // Typically identified by group name or code, or parent group "Bank Accounts"
    const bankKeywords = ["BANK", "CASH", "HDFC", "ICICI", "SBI", "ACCOUNT"]; // Simple heuristic
    const groupName = (account.groupName || "").toUpperCase();
    
    return groupName.includes("BANK") || groupName.includes("OD ACCOUNT");
  },

  /**
   * BRS Calculation
   * Balance as per Books
   * + Add: Not in Bank (Unmatched book entries)
   * - Less: Not in Books (Unmatched bank transactions)
   * = Balance as per Bank
   */
  async getBRSReport(companyId, bankLedgerId) {
    if (!bankLedgerId) {
      return { bookBalance: 0, notInBank: 0, notInBooks: 0, bankBalance: 0, difference: 0 };
    }

    const BankTransaction = await getBankTransactionModel();
    const Payment = await getPaymentModel();
    const JournalLine = await getJournalLineModel();

    // 1. Balance as per Books (current ledger balance)
    const journalLines = await JournalLine.find({ companyId, accountId: bankLedgerId }).lean();
    const bookBalance = journalLines.reduce((sum, line) => sum + (line.debitAmount || 0) - (line.creditAmount || 0), 0);

    // 2. Add: Not in Bank (Book entries that hit THIS bank ledger and are NOT reconciled)
    // We search for JournalLines (which include both manual journals and payment journals)
    // where the account is the bankLedgerId and isReconciled is false.
    // Note: We need to ensure JournalLine has an isReconciled flag or check the parent.
    // For now, let's use Payment records as a primary source for "Book entries" in BRS.
    
    // We need to find payments that hit this specific bank ledger.
    // This requires looking up the Payment's journalId -> JournalLines -> find bankLedgerId.
    const unmatchedPayments = await Payment.find({
      companyId,
      reconciliationStatus: { $ne: "FULLY_RECONCILED" },
    }).populate("journalId").lean();

    let notInBank = 0;
    for (const p of unmatchedPayments) {
      const pLines = await JournalLine.find({ journalId: p.journalId?._id, accountId: bankLedgerId }).lean();
      if (pLines.length > 0) {
        notInBank += (p.amountPaid || 0);
      }
    }

    // 3. Less: Not in Books (Bank entries that are NOT matched for THIS ledger)
    const unmatchedBankTxs = await BankTransaction.find({
      companyId,
      bankLedgerId,
      reconciliationStatus: "UNMATCHED",
    }).lean();

    const notInBooks = unmatchedBankTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    return {
      bookBalance,
      notInBank,
      notInBooks,
      bankBalance: bookBalance + notInBank - notInBooks,
      difference: (bookBalance + notInBank - notInBooks) - bookBalance,
    };
  }
};
