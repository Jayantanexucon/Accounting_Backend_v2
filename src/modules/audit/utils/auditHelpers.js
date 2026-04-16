/**
 * Helper functions for audit log formatting and transformation
 */

/**
 * Format field values for display
 */
export const formatValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (value instanceof Date) {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  if (typeof value === "number" && (Math.abs(value) > 1000 || value % 1 !== 0)) {
    // Format as currency if it looks like money
    return new Intl.NumberFormat("en-IN", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (Array.isArray(value)) {
    return `${value.length} item${value.length !== 1 ? "s" : ""}`;
  }

  if (typeof value === "object") {
    return "Object data";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
};

/**
 * Get user-friendly field labels for different entity types
 */
export const getFieldLabel = (field, entityType = null) => {
  // Common field labels across all entities
  const commonLabels = {
    date: "Date",
    status: "Status",
    notes: "Notes",
    description: "Description",
    referenceNumber: "Reference Number",
    externalDocNo: "External Document No",
    createdBy: "Created By",
    updatedBy: "Updated By",
    currency: "Currency",
    total: "Total",
    amount: "Amount",
    narration: "Narration",
  };

  // Entity-specific labels
  const entityLabels = {
    Invoice: {
      invoiceDate: "Invoice Date",
      amountDue: "Amount Due",
      items: "Items",
      approvalStatus: "Approval Status",
      accountingStatus: "Accounting Status",
      billTo: "Bill To",
      shipTo: "Ship To",
      totalTaxableValue: "Taxable Value",
      totalCGSTAmount: "CGST Amount",
      totalSGSTAmount: "SGST Amount",
      totalIGSTAmount: "IGST Amount",
      totalTDSAmount: "TDS Amount",
      netPayable: "Net Payable",
      poreferencevalue: "PO Reference",
      dueDate: "Due Date",
      referenceDate: "Reference Date",
      paymentMode: "Payment Mode",
      valueInWords: "Amount in Words",
      withSignature: "With Signature",
      clientId: "Client",
      vendorId: "Vendor",
    },
    Journal: {
      journalDate: "Journal Date",
      journalNumber: "Journal Number",
      journalLines: "Journal Lines",
      narration: "Narration",
      voucherType: "Voucher Type",
      sourceType: "Source Type",
      posted: "Posted",
      accountId: "Account",
      debit: "Debit",
      credit: "Credit",
    },
    PurchaseOrder: {
      poNumber: "PO Number",
      poreferencevalue: "Client Reference",
      poDate: "PO Date",
      deliveryDate: "Delivery Date",
      referenceDate: "Reference Date",
      totalAmount: "Total Amount",
      paymentTerms: "Payment Terms",
      client: "Client",
      deliverTo: "Deliver To",
      items: "Items",
      totalTaxableValue: "Taxable Value",
      totalCGSTAmount: "CGST",
      totalSGSTAmount: "SGST",
      totalIGSTAmount: "IGST",
      valueInWords: "Amount in Words",
      withSignature: "With Signature",
    },
    Payment: {
      payment: "Payment",
      receivedAmount: "Received Amount",
      paymentMode: "Payment Mode",
      referenceNumber: "Reference Number",
      tdsAdjusted: "TDS Adjusted",
      invoicePaymentStatus: "Payment Status",
      journalId: "Journal",
      remarks: "Remarks",
      invoiceId: "Invoice",
    },
    Account: {
      accountName: "Account Name",
      accountCode: "Account Code",
      accountType: "Account Type",
      parentAccount: "Parent Account",
      isActive: "Active",
      description: "Description",
    },
    Company: {
      companyName: "Company Name",
      registrationNumber: "Registration Number",
      taxId: "Tax ID",
      address: "Address",
      email: "Email",
      phone: "Phone",
    },
    User: {
      name: "Name",
      email: "Email",
      role: "Role",
      status: "Status",
      department: "Department",
    },
    Client: {
      clientName: "Client Name",
      email: "Email",
      phone: "Phone",
      address: "Address",
      taxId: "Tax ID",
    },
    Vendor: {
      vendorName: "Vendor Name",
      email: "Email",
      phone: "Phone",
      address: "Address",
      taxId: "Tax ID",
      paymentTerms: "Payment Terms",
    },
  };

  // Try entity-specific labels first
  if (entityType && entityLabels[entityType] && entityLabels[entityType][field]) {
    return entityLabels[entityType][field];
  }

  // Fall back to common labels
  if (commonLabels[field]) {
    return commonLabels[field];
  }

  // Auto-format field name
  return field.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
};

/**
 * Get action-friendly labels
 */
export const getActionLabel = (action) => {
  const labels = {
    CREATE: "Created",
    UPDATE: "Updated",
    DELETE: "Deleted",
    APPROVE: "Approved",
    REJECT: "Rejected",
    STATUS_CHANGE: "Status Changed",
    EXPORT: "Exported",
    IMPORT: "Imported",
    PAID: "Paid",
    POSTED: "Posted",
    APPROVED: "Approved",
    "PO_CREATED": "Created",
    "PO_UPDATED": "Updated",
    "PO_DELETED": "Deleted",
    "PO_STATUS_UPDATED": "Status Changed",
  };

  return labels[action] || action.replace(/_/g, " ");
};

/**
 * Get entity type label
 */
export const getEntityTypeLabel = (entityType) => {
  const labels = {
    Invoice: "Invoice",
    PurchaseOrder: "Purchase Order",
    Payment: "Payment",
    Journal: "Journal",
    Account: "Account",
    Group: "Group",
    User: "User",
    Company: "Company",
    Client: "Client",
    Vendor: "Vendor",
    Config: "Configuration",
    Entity: "Entity",
  };

  return labels[entityType] || entityType;
};

/**
 * Determine the type of change
 */
export const determineChangeType = (oldValue, newValue) => {
  if (oldValue === null || oldValue === undefined || oldValue === "") {
    return "added";
  }
  if (newValue === null || newValue === undefined || newValue === "") {
    return "removed";
  }
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    if (oldValue.length < newValue.length) return "items_added";
    if (oldValue.length > newValue.length) return "items_removed";
    return "items_modified";
  }
  return "changed";
};

/**
 * Get human-readable change description
 */
export const getChangeDescription = (fieldLabel, oldValue, newValue, changeType) => {
  switch (changeType) {
    case "added":
      return `${fieldLabel} set to ${newValue}`;
    case "removed":
      return `${fieldLabel} removed`;
    case "items_added":
      return `Items added to ${fieldLabel}`;
    case "items_removed":
      return `Items removed from ${fieldLabel}`;
    case "items_modified":
      return `${fieldLabel} items modified`;
    default:
      return `${fieldLabel} changed from ${oldValue} to ${newValue}`;
  }
};

/**
 * Format date for display
 */
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Format time for display
 */
export const formatTime = (date) => {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Get icon for change type
 */
export const getChangeIcon = (changeType) => {
  const icons = {
    added: "➕",
    removed: "➖",
    changed: "✏️",
    items_added: "📍",
    items_removed: "🗑️",
    items_modified: "🔄",
  };

  return icons[changeType] || "📝";
};

/**
 * Get color for change type
 */
export const getChangeColor = (changeType) => {
  const colors = {
    added: "green",
    removed: "red",
    changed: "blue",
    items_added: "green",
    items_removed: "red",
    items_modified: "orange",
  };

  return colors[changeType] || "gray";
};

/**
 * Process journal lines for display
 */
export const processJournalLines = (lines, accountMap = {}) => {
  if (!Array.isArray(lines)) {
    return { count: 0, totalDebit: 0, totalCredit: 0, accounts: [] };
  }

  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

  return {
    count: lines.length,
    totalDebit,
    totalCredit,
    accounts: lines.map((line) => ({
      accountId: line.accountId,
      accountName: accountMap[line.accountId?.toString()] || "Unknown Account",
      debit: line.debit || 0,
      credit: line.credit || 0,
    })),
  };
};

/**
 * Compare old and new journal lines to identify specific changes
 */
export const compareJournalLines = (oldLines, newLines, accountMap = {}) => {
  if (!Array.isArray(oldLines) || !Array.isArray(newLines)) {
    return { changes: 0, added: [], removed: [], modified: [] };
  }

  const oldMap = new Map();
  const newMap = new Map();

  oldLines.forEach((line, index) => {
    const key = line.accountId?.toString() || `line-${index}`;
    oldMap.set(key, line);
  });

  newLines.forEach((line, index) => {
    const key = line.accountId?.toString() || `line-${index}`;
    newMap.set(key, line);
  });

  const added = [];
  const removed = [];
  const modified = [];

  newMap.forEach((newLine, key) => {
    if (!oldMap.has(key)) {
      added.push({
        accountId: newLine.accountId,
        accountName: accountMap[newLine.accountId?.toString()] || "Unknown Account",
        debit: newLine.debit || 0,
        credit: newLine.credit || 0,
        action: "added",
      });
    }
  });

  oldMap.forEach((oldLine, key) => {
    if (!newMap.has(key)) {
      removed.push({
        accountId: oldLine.accountId,
        accountName: accountMap[oldLine.accountId?.toString()] || "Unknown Account",
        debit: oldLine.debit || 0,
        credit: oldLine.credit || 0,
        action: "removed",
      });
    } else {
      const newLine = newMap.get(key);
      if (oldLine.debit !== newLine.debit || oldLine.credit !== newLine.credit) {
        modified.push({
          accountId: oldLine.accountId,
          accountName: accountMap[oldLine.accountId?.toString()] || "Unknown Account",
          oldDebit: oldLine.debit || 0,
          oldCredit: oldLine.credit || 0,
          newDebit: newLine.debit || 0,
          newCredit: newLine.credit || 0,
          action: "modified",
        });
      }
    }
  });

  return {
    changes: added.length + removed.length + modified.length,
    added,
    removed,
    modified,
    summary: {
      oldTotalDebit: oldLines.reduce((sum, line) => sum + (line.debit || 0), 0),
      oldTotalCredit: oldLines.reduce((sum, line) => sum + (line.credit || 0), 0),
      newTotalDebit: newLines.reduce((sum, line) => sum + (line.debit || 0), 0),
      newTotalCredit: newLines.reduce((sum, line) => sum + (line.credit || 0), 0),
    },
  };
};
