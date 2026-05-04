const round2 = (value = 0) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const buildFallbackGstBreakdown = (fallback = {}) => {
  const fallbackRate = round2(fallback.rate ?? 0);
  const fallbackAmount = round2(fallback.amount ?? 0);
  const explicitCgstAmount = round2(fallback.cgstAmount ?? 0);
  const explicitSgstAmount = round2(fallback.sgstAmount ?? 0);
  const explicitIgstAmount = round2(fallback.igstAmount ?? 0);

  if (explicitCgstAmount > 0 || explicitSgstAmount > 0 || explicitIgstAmount > 0) {
    const breakdown = [];
    if (explicitCgstAmount > 0) {
      breakdown.push({
        taxType: "CGST",
        label: "CGST",
        rate: round2(fallback.cgstRate ?? fallbackRate / 2),
        amount: explicitCgstAmount,
      });
    }
    if (explicitSgstAmount > 0) {
      breakdown.push({
        taxType: "SGST",
        label: "SGST",
        rate: round2(fallback.sgstRate ?? fallbackRate / 2),
        amount: explicitSgstAmount,
      });
    }
    if (explicitIgstAmount > 0) {
      breakdown.push({
        taxType: "IGST",
        label: "IGST",
        rate: round2(fallback.igstRate ?? fallbackRate),
        amount: explicitIgstAmount,
      });
    }
    return breakdown;
  }

  if (fallbackAmount <= 0 || fallbackRate <= 0) {
    return [];
  }

  if (fallback.gstSplit === "INTRA") {
    const halfRate = round2(fallbackRate / 2);
    const firstHalfAmount = round2(fallbackAmount / 2);
    return [
      { taxType: "CGST", label: "CGST", rate: halfRate, amount: firstHalfAmount },
      { taxType: "SGST", label: "SGST", rate: halfRate, amount: round2(fallbackAmount - firstHalfAmount) },
    ];
  }

  if (fallback.gstSplit === "INTER") {
    return [
      { taxType: "IGST", label: "IGST", rate: fallbackRate, amount: fallbackAmount },
    ];
  }

  return [];
};

const deriveBreakdownAmounts = (taxBreakdown = [], item = {}) => {
  const totals = {
    cgstAmount: round2(item?.cgstAmount || 0),
    sgstAmount: round2(item?.sgstAmount || 0),
    igstAmount: round2(item?.igstAmount || 0),
  };

  (taxBreakdown || []).forEach((entry) => {
    const type = String(entry?.taxType || entry?.label || "").trim().toUpperCase();
    const amount = round2(entry?.amount || 0);
    if (type === "CGST") totals.cgstAmount = round2(totals.cgstAmount + amount);
    if (type === "SGST") totals.sgstAmount = round2(totals.sgstAmount + amount);
    if (type === "IGST") totals.igstAmount = round2(totals.igstAmount + amount);
  });

  return totals;
};

const shouldEnforceGstSplit = (normalized = [], fallback = {}) => {
  const fallbackType = String(fallback.taxType || fallback.label || "").trim().toUpperCase();
  if (fallbackType !== "GST") return false;

  const hasExplicitSplitAmounts =
    round2(fallback.cgstAmount ?? 0) > 0 ||
    round2(fallback.sgstAmount ?? 0) > 0 ||
    round2(fallback.igstAmount ?? 0) > 0;

  if (hasExplicitSplitAmounts) return true;
  if (!fallback.gstSplit) return false;

  const breakdownTypes = (normalized || []).map((entry) =>
    String(entry?.taxType || entry?.label || "").trim().toUpperCase()
  );

  if (breakdownTypes.length === 0) return true;
  if (breakdownTypes.some((type) => type === "GST")) return true;

  const hasCgst = breakdownTypes.includes("CGST");
  const hasSgst = breakdownTypes.includes("SGST");
  const hasIgst = breakdownTypes.includes("IGST");

  if (fallback.gstSplit === "INTRA") {
    return hasIgst || !hasCgst || !hasSgst;
  }

  if (fallback.gstSplit === "INTER") {
    return hasCgst || hasSgst || !hasIgst;
  }

  return false;
};

export const normalizeTaxBreakdown = (taxBreakdown = [], fallback = {}) => {
  const normalized = Array.isArray(taxBreakdown)
    ? taxBreakdown
        .map((entry) => ({
          taxType: String(entry?.taxType || entry?.label || fallback.taxType || "GST").trim(),
          label: String(entry?.label || entry?.taxType || fallback.label || fallback.taxType || "GST").trim(),
          rate: round2(entry?.rate ?? fallback.rate ?? 0),
          amount: round2(entry?.amount ?? fallback.amount ?? 0),
        }))
        .filter((entry) => entry.taxType && entry.amount >= 0)
    : [];

  const fallbackType = String(fallback.taxType || fallback.label || "").trim().toUpperCase();
  if (fallbackType === "GST" && shouldEnforceGstSplit(normalized, fallback)) {
    const fallbackRate = normalized.length > 0
      ? round2(normalized.reduce((sum, entry) => sum + Number(entry.rate || 0), 0))
      : round2(fallback.rate ?? 0);
    const fallbackAmount = normalized.length > 0
      ? round2(normalized.reduce((sum, entry) => sum + Number(entry.amount || 0), 0))
      : round2(fallback.amount ?? 0);
    const gstBreakdown = buildFallbackGstBreakdown(fallback);
    if (gstBreakdown.length > 0) {
      return gstBreakdown;
    }
    const synthesizedBreakdown = buildFallbackGstBreakdown({
      ...fallback,
      rate: fallbackRate,
      amount: fallbackAmount,
    });
    if (synthesizedBreakdown.length > 0) {
      return synthesizedBreakdown;
    }
  }

  if (normalized.length > 0) {
    return normalized;
  }

  const fallbackAmount = round2(fallback.amount ?? 0);
  const fallbackRate = round2(fallback.rate ?? 0);
  const fallbackTypeRaw = String(fallback.taxType || fallback.label || "").trim();

  if (!fallbackTypeRaw && fallbackAmount <= 0 && fallbackRate <= 0) {
    return [];
  }

  return [
    {
      taxType: fallbackTypeRaw || "GST",
      label: String(fallback.label || fallbackTypeRaw || "GST").trim(),
      rate: fallbackRate,
      amount: fallbackAmount,
    },
  ];
};

export const normalizeLineItemTax = (item = {}, fallback = {}) => {
  const taxType = item.taxType || item.taxLabel || fallback.taxType || "GST";
  const taxLabel = item.taxLabel || item.taxType || fallback.taxLabel || taxType;
  // CRITICAL FIX: Prioritize gstRate over taxRate
  // gstRate is the source of truth from HSN, while taxRate might be stale from previous saves
  const taxRate = round2(item.gstRate ?? item.taxRate ?? fallback.gstRate ?? fallback.taxRate ?? 0);

  // ── DERIVE gstSplit FROM EXISTING ITEM BREAKDOWN WHEN NOT PROVIDED ────────
  // When recalculating old data (e.g. in repo recalculateItemTotals), the caller
  // may not know the gstSplit. We can infer it from the item's existing taxBreakdown
  // or its cgstAmount/sgstAmount/igstAmount fields so CGST+SGST items don't get
  // collapsed into IGST on retrieval.
  let effectiveGstSplit = fallback.gstSplit;
  if (!effectiveGstSplit) {
    const existingBreakdown = Array.isArray(item.taxBreakdown) ? item.taxBreakdown : [];
    const breakdownTypes = existingBreakdown.map((e) =>
      String(e?.taxType || e?.label || "").trim().toUpperCase()
    );
    const hasCgstOrSgst = breakdownTypes.includes("CGST") || breakdownTypes.includes("SGST");
    const hasIgst = breakdownTypes.includes("IGST");

    if (hasCgstOrSgst && !hasIgst) {
      effectiveGstSplit = "INTRA";
    } else if (hasIgst && !hasCgstOrSgst) {
      effectiveGstSplit = "INTER";
    } else if (!hasCgstOrSgst && !hasIgst) {
      // No breakdown — fall back to individual split amount fields on item
      const hasCgstAmt = round2(item.cgstAmount ?? 0) > 0;
      const hasSgstAmt = round2(item.sgstAmount ?? 0) > 0;
      const hasIgstAmt = round2(item.igstAmount ?? 0) > 0;
      if ((hasCgstAmt || hasSgstAmt) && !hasIgstAmt) effectiveGstSplit = "INTRA";
      else if (hasIgstAmt && !hasCgstAmt && !hasSgstAmt) effectiveGstSplit = "INTER";
    }
  }
  
  // ── CRITICAL FIX ──────────────────────────────────────────────────────────
  // ALWAYS recalculate tax amount from taxableValue × taxRate instead of trusting
  // frontend-provided taxAmount/gstAmount. Frontend may send stale values from 
  // previous edits, causing tax totals to be incorrect.
  // ──────────────────────────────────────────────────────────────────────────
  const taxableValue = round2(Number(item.taxableValue) || 0);
  let calculatedTaxAmount = round2(0);
  
  if (taxableValue > 0 && taxRate > 0) {
    // Recalculate from first principles: taxableValue × (taxRate / 100)
    calculatedTaxAmount = round2((taxableValue * taxRate) / 100);
  }
  
  // Use calculated value if item had a taxableValue, otherwise fall back to provided value
  const taxAmount = taxableValue > 0 ? calculatedTaxAmount : 
    round2(item.taxAmount ?? item.gstAmount ?? fallback.taxAmount ?? fallback.gstAmount ?? 0);
  
  // ── ALSO CRITICAL: Rebuild taxBreakdown with correct amounts ───────────────
  // If we have a taxableValue and taxRate, REBUILD the breakdown with correct amounts
  // instead of trusting the stale amounts from item.taxBreakdown
  // ──────────────────────────────────────────────────────────────────────────
  let taxBreakdown = [];
  
  if (taxableValue > 0 && taxRate > 0) {
    // Rebuild the breakdown with recalculated amounts ONLY
    // CRITICAL: Do NOT pass item.cgstAmount, item.sgstAmount, item.igstAmount
    // as those are stale and would be reused. Let buildFallbackGstBreakdown
    // derive them from the recalculated amount and effectiveGstSplit.
    taxBreakdown = buildFallbackGstBreakdown({
      rate: taxRate,
      amount: taxAmount,
      gstSplit: effectiveGstSplit,  // ← uses inferred split when fallback didn't provide one
      // ← Explicitly NOT passing cgstAmount/sgstAmount/igstAmount from item!
    });
  } else {
    // Fall back to normalizing the provided breakdown
    taxBreakdown = normalizeTaxBreakdown(item.taxBreakdown, {
      taxType,
      label: taxLabel,
      rate: taxRate,
      amount: taxAmount,
      cgstAmount: item.cgstAmount ?? fallback.cgstAmount,
      sgstAmount: item.sgstAmount ?? fallback.sgstAmount,
      igstAmount: item.igstAmount ?? fallback.igstAmount,
      cgstRate: item.cgstRate ?? fallback.cgstRate,
      sgstRate: item.sgstRate ?? fallback.sgstRate,
      igstRate: item.igstRate ?? fallback.igstRate,
      gstSplit: effectiveGstSplit,  // ← same here
    });
  }

  const combinedTaxRate = taxBreakdown.length > 0
    ? round2(taxBreakdown.reduce((sum, entry) => sum + Number(entry.rate || 0), 0))
    : taxRate;
  const combinedTaxAmount = taxBreakdown.length > 0
    ? round2(taxBreakdown.reduce((sum, entry) => sum + Number(entry.amount || 0), 0))
    : taxAmount;
  
  // ── CRITICAL: When we rebuild the breakdown from recalculated values,
  // derive split amounts from the breakdown ONLY, not from stale item values ──
  let splitTaxAmounts = { cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
  
  if (taxableValue > 0 && taxRate > 0) {
    // We rebuilt the breakdown, so derive split amounts from it
    // Do NOT use item's stale split amounts as fallback
    splitTaxAmounts = deriveBreakdownAmounts(taxBreakdown, {});  // Pass empty object, not item!
  } else {
    // We're using provided/normalized breakdown, so use item's values as fallback
    splitTaxAmounts = deriveBreakdownAmounts(taxBreakdown, item);
  }

  return {
    taxType,
    taxLabel,
    taxRate: combinedTaxRate,
    taxAmount: combinedTaxAmount,
    combinedTaxRate,
    taxBreakdown,
    gstRate: combinedTaxRate,        // ← Use recalculated rate, NOT item.gstRate (could be stale)
    gstAmount: combinedTaxAmount,    // ← Use recalculated amount, NOT item.gstAmount (could be stale)
    cgstAmount: splitTaxAmounts.cgstAmount,
    sgstAmount: splitTaxAmounts.sgstAmount,
    igstAmount: splitTaxAmounts.igstAmount,
  };
};

export const buildTaxSummary = ({
  taxSummary = [],
  items = [],
  fallbackTaxType = "GST",
  fallbackTaxLabel,
} = {}) => {
  const normalizedSummary = Array.isArray(taxSummary)
    ? taxSummary
        .map((entry) => ({
          taxType: String(entry?.taxType || entry?.label || fallbackTaxType).trim(),
          label: String(entry?.label || entry?.taxType || fallbackTaxLabel || fallbackTaxType).trim(),
          rate: round2(entry?.rate ?? 0),
          amount: round2(entry?.amount ?? 0),
        }))
        .filter((entry) => entry.taxType && entry.amount >= 0)
    : [];

  if (normalizedSummary.length > 0) {
    return normalizedSummary;
  }

  const summaryMap = new Map();
  (items || []).forEach((item) => {
    const breakdown = normalizeTaxBreakdown(item?.taxBreakdown, {
      taxType: item?.taxType || fallbackTaxType,
      label: item?.taxLabel || fallbackTaxLabel || item?.taxType || fallbackTaxType,
      rate: item?.taxRate ?? item?.gstRate ?? 0,
      amount: item?.taxAmount ?? item?.gstAmount ?? 0,
    });

    breakdown.forEach((entry) => {
      const key = `${entry.taxType}::${entry.label}`;
      const current = summaryMap.get(key) || {
        taxType: entry.taxType,
        label: entry.label,
        rate: 0,
        amount: 0,
      };
      current.rate = round2(Math.max(current.rate, Number(entry.rate || 0)));
      current.amount = round2(current.amount + Number(entry.amount || 0));
      summaryMap.set(key, current);
    });
  });

  return [...summaryMap.values()];
};

export const deriveLegacyGstTotals = (taxSummary = []) => {
  const totals = { totalCGSTAmount: 0, totalSGSTAmount: 0, totalIGSTAmount: 0, totalGSTAmount: 0 };

  (taxSummary || []).forEach((entry) => {
    const amount = round2(entry?.amount || 0);
    const type = String(entry?.taxType || entry?.label || "").trim().toUpperCase();
    if (type === "CGST") totals.totalCGSTAmount = round2(totals.totalCGSTAmount + amount);
    if (type === "SGST") totals.totalSGSTAmount = round2(totals.totalSGSTAmount + amount);
    if (type === "IGST") totals.totalIGSTAmount = round2(totals.totalIGSTAmount + amount);
    if (["GST", "CGST", "SGST", "IGST"].includes(type)) {
      totals.totalGSTAmount = round2(totals.totalGSTAmount + amount);
    }
  });

  return totals;
};

export const buildTaxMeta = ({
  taxType,
  taxLabel,
  taxSummary = [],
  totalTaxAmount,
  items = [],
} = {}) => {
  const normalizedSummary = buildTaxSummary({
    taxSummary,
    items,
    fallbackTaxType: taxType || "GST",
    fallbackTaxLabel: taxLabel || taxType || "GST",
  });
  const derivedTaxType = taxType || normalizedSummary[0]?.taxType || "GST";
  const derivedTaxLabel = taxLabel || normalizedSummary[0]?.label || derivedTaxType;
  const derivedTotalTaxAmount = round2(
    totalTaxAmount ??
      normalizedSummary.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
  );
  const legacyTotals = deriveLegacyGstTotals(normalizedSummary);

  return {
    taxType: derivedTaxType,
    taxLabel: derivedTaxLabel,
    taxSummary: normalizedSummary,
    totalTaxAmount: derivedTotalTaxAmount,
    ...legacyTotals,
  };
};

export { round2 };