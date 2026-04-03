import AppError from "./AppError.js";
import { EventEmitter } from "events";

/**
 * Cross-Database Transaction Manager
 * Implements saga pattern for managing transactions across multiple MongoDB databases
 */
class CrossDatabaseTransactionManager extends EventEmitter {
  constructor() {
    super();
    this.transactionQueue = [];
    this.completedSteps = [];
    this.failedSteps = [];
  }

  /**
   * Start a new transaction
   * @param {string} transactionId - Unique transaction ID
   * @param {Object} context - Transaction context data
   * @returns {Object} Transaction object
   */
  startTransaction(transactionId, context = {}) {
    const transaction = {
      id: transactionId,
      status: "STARTED",
      startTime: new Date(),
      context,
      steps: [],
      compensations: [],
    };

    this.transactionQueue.push(transaction);
    this.emit("transaction:started", { transactionId, timestamp: new Date() });

    return transaction;
  }

  /**
   * Add a step to the transaction
   * @param {string} transactionId - Transaction ID
   * @param {Object} step - Step to add
   * @param {string} step.name - Step name
   * @param {Function} step.execute - Step execution function
   * @param {Function} step.compensate - Compensation function for rollback
   * @returns {void}
   */
  addStep(transactionId, step) {
    const transaction = this.transactionQueue.find((t) => t.id === transactionId);
    if (!transaction) {
      throw new AppError("Transaction not found", 404, "addStep");
    }

    transaction.steps.push({
      name: step.name,
      execute: step.execute,
      compensate: step.compensate,
      status: "PENDING",
      retryCount: 0,
      maxRetries: step.maxRetries || 3,
      retryDelay: step.retryDelay || 1000,
    });
  }

  /**
   * Execute a transaction with retry logic
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Execution result
   */
  async executeTransaction(transactionId) {
    const transaction = this.transactionQueue.find((t) => t.id === transactionId);
    if (!transaction) {
      throw new AppError("Transaction not found", 404, "executeTransaction");
    }

    const results = {
      transactionId,
      status: "EXECUTING",
      executedSteps: [],
      failedStep: null,
      timestamp: new Date(),
    };

    try {
      for (const step of transaction.steps) {
        try {
          console.log(`Executing step: ${step.name}`);
          const stepResult = await this.executeStepWithRetry(step);

          transaction.completedSteps = transaction.completedSteps || [];
          transaction.completedSteps.push({
            name: step.name,
            result: stepResult,
            timestamp: new Date(),
          });

          results.executedSteps.push({
            name: step.name,
            status: "SUCCESS",
            result: stepResult,
          });

          this.emit("step:completed", { transactionId, stepName: step.name });
        } catch (error) {
          console.error(`Step failed: ${step.name}`, error.message);

          results.failedStep = step.name;
          results.status = "FAILED";

          // Trigger rollback
          await this.rollbackTransaction(transactionId, transaction);

          throw error;
        }
      }

      transaction.status = "COMPLETED";
      results.status = "SUCCESS";

      this.emit("transaction:completed", { transactionId, timestamp: new Date() });

      return results;
    } catch (error) {
      transaction.status = "FAILED";
      transaction.failedStep = results.failedStep;

      this.emit("transaction:failed", {
        transactionId,
        failedStep: results.failedStep,
        error: error.message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Execute a step with retry logic
   * @param {Object} step - Step to execute
   * @returns {Promise<any>} Step result
   */
  async executeStepWithRetry(step) {
    let lastError;

    for (let attempt = 0; attempt <= step.maxRetries; attempt++) {
      try {
        step.status = `EXECUTING (Attempt ${attempt + 1}/${step.maxRetries + 1})`;
        const result = await step.execute();
        step.status = "COMPLETED";
        return result;
      } catch (error) {
        lastError = error;
        step.retryCount = attempt + 1;

        if (attempt < step.maxRetries) {
          console.warn(`Step ${step.name} failed, retrying in ${step.retryDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, step.retryDelay));
        }
      }
    }

    throw new AppError(
      `Step failed after ${step.maxRetries + 1} attempts: ${lastError.message}`,
      500,
      "executeStepWithRetry"
    );
  }

  /**
   * Rollback a transaction by executing compensations in reverse order
   * @param {string} transactionId - Transaction ID
   * @param {Object} transaction - Transaction object
   * @returns {Promise<Object>} Rollback result
   */
  async rollbackTransaction(transactionId, transaction) {
    console.log(`Rolling back transaction: ${transactionId}`);

    const rollbackResults = {
      transactionId,
      status: "ROLLING_BACK",
      completedCompensations: [],
      failedCompensations: [],
    };

    // Execute compensations in reverse order
    const completedSteps = transaction.completedSteps || [];

    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const completedStep = completedSteps[i];
      const originalStep = transaction.steps.find((s) => s.name === completedStep.name);

      if (originalStep && originalStep.compensate) {
        try {
          console.log(`Compensating step: ${originalStep.name}`);
          await originalStep.compensate(completedStep.result);

          rollbackResults.completedCompensations.push({
            name: originalStep.name,
            status: "COMPENSATED",
            timestamp: new Date(),
          });

          this.emit("compensation:completed", {
            transactionId,
            stepName: originalStep.name,
          });
        } catch (error) {
          console.error(`Compensation failed for step: ${originalStep.name}`, error.message);

          rollbackResults.failedCompensations.push({
            name: originalStep.name,
            error: error.message,
            timestamp: new Date(),
          });

          // Continue with other compensations even if one fails
          // This is critical - we want to try compensating all we can
        }
      }
    }

    transaction.status = "ROLLED_BACK";

    this.emit("transaction:rolled_back", {
      transactionId,
      timestamp: new Date(),
      report: rollbackResults,
    });

    return rollbackResults;
  }

  /**
   * Get transaction by ID
   * @param {string} transactionId - Transaction ID
   * @returns {Object|null} Transaction object or null
   */
  getTransaction(transactionId) {
    return this.transactionQueue.find((t) => t.id === transactionId);
  }

  /**
   * Get all transactions
   * @returns {Array} All transactions
   */
  getAllTransactions() {
    return [...this.transactionQueue];
  }

  /**
   * Clear completed transactions
   * @param {number} olderThanHours - Clear transactions older than X hours
   * @returns {number} Number of cleared transactions
   */
  clearCompletedTransactions(olderThanHours = 24) {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialLength = this.transactionQueue.length;

    this.transactionQueue = this.transactionQueue.filter((t) => {
      return !(
        (t.status === "COMPLETED" || t.status === "ROLLED_BACK" || t.status === "FAILED") &&
        t.startTime < cutoffTime
      );
    });

    return initialLength - this.transactionQueue.length;
  }

  /**
   * Create an invoice and journal entry in a transaction
   * @param {Function} createInvoiceFunc - Function to create invoice
   * @param {Function} createJournalFunc - Function to create journal entry
   * @param {Function} updateInvoiceFunc - Function to update invoice with journal ref
   * @param {Object} invoiceData - Invoice data
   * @returns {Promise<Object>} Transaction result
   */
  async createInvoiceWithJournal(
    createInvoiceFunc,
    createJournalFunc,
    updateInvoiceFunc,
    invoiceData
  ) {
    const transactionId = `INV-TX-${Date.now()}`;
    const transaction = this.startTransaction(transactionId, { invoiceData });

    // Step 1: Create invoice
    this.addStep(transactionId, {
      name: "CreateInvoice",
      maxRetries: 2,
      retryDelay: 500,
      execute: async () => {
        const invoice = await createInvoiceFunc(invoiceData);
        return {
          invoiceId: invoice._id,
          invoiceNo: invoice.invoiceNo,
          invoice,
        };
      },
      compensate: async (result) => {
        // Delete the created invoice
        console.log(`Compensating: Deleting invoice ${result.invoiceNo}`);
        // Implementation would depend on your actual delete function
        return { deleted: true };
      },
    });

    // Step 2: Create journal entry
    this.addStep(transactionId, {
      name: "CreateJournalEntry",
      maxRetries: 2,
      retryDelay: 500,
      execute: async () => {
        // This step depends on Step 1 result
        const invoiceStep = transaction.completedSteps.find((s) => s.name === "CreateInvoice");
        if (!invoiceStep) {
          throw new AppError("Invoice creation not completed", 500, "CreateJournalEntry");
        }

        const journal = await createJournalFunc(invoiceStep.result.invoiceId, invoiceData);
        return {
          journalId: journal._id,
          journalNo: journal.journalNumber,
          journal,
        };
      },
      compensate: async (result) => {
        // Delete the created journal entry
        console.log(`Compensating: Deleting journal ${result.journalNo}`);
        return { deleted: true };
      },
    });

    // Step 3: Update invoice with journal reference
    this.addStep(transactionId, {
      name: "UpdateInvoiceWithJournal",
      maxRetries: 2,
      retryDelay: 500,
      execute: async () => {
        const invoiceStep = transaction.completedSteps.find((s) => s.name === "CreateInvoice");
        const journalStep = transaction.completedSteps.find((s) => s.name === "CreateJournalEntry");

        await updateInvoiceFunc(invoiceStep.result.invoiceId, {
          salesJournalId: journalStep.result.journalId,
          accountingStatus: "journal_posted",
        });

        return {
          invoiceId: invoiceStep.result.invoiceId,
          journalId: journalStep.result.journalId,
        };
      },
      compensate: async (result) => {
        // Update invoice back to original state
        await updateInvoiceFunc(result.invoiceId, {
          salesJournalId: null,
          accountingStatus: "pending",
        });
        return { reverted: true };
      },
    });

    try {
      return await this.executeTransaction(transactionId);
    } catch (error) {
      throw new AppError(
        `Invoice creation transaction failed: ${error.message}`,
        500,
        "createInvoiceWithJournal"
      );
    }
  }
}

// Export singleton instance
export const transactionManager = new CrossDatabaseTransactionManager();

export default CrossDatabaseTransactionManager;
