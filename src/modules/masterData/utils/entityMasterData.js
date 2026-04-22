import { findCountryByIdRepo, findCountryByNameRepo } from "../repos/countryRepo.js";

const ADDRESS_TYPES = ["DEFAULT", "SHIP_TO", "BILL_TO", "BRANCH", "OTHER"];

const TAX_FIELD_MAP = {
  GST: "gstNumber",
  PAN: "panNumber",
  VAT: "vatNumber",
  EIN: "einNumber",
  SSN: "ssnNumber",
  CompanyNumber: "companyNumber",
  NationalID: "nationalIdNumber",
  TIN: "taxIdentificationNumber",
  ABN: "taxIdentificationNumber",
  ACN: "taxIdentificationNumber",
  UEN: "taxIdentificationNumber",
  BN: "taxIdentificationNumber",
  GST_HST: "taxIdentificationNumber",
  CorporateNumber: "taxIdentificationNumber",
  SIREN: "taxIdentificationNumber",
  Steuernummer: "taxIdentificationNumber",
  TRN: "taxIdentificationNumber",
};

export const DEFAULT_TAX_TYPES_BY_COUNTRY_TYPE = {
  GST: ["GST", "PAN"],
  VAT: ["VAT", "CompanyNumber"],
  SALES_TAX: ["EIN", "SSN"],
  CORPORATE_TAX: ["CompanyNumber", "NationalID"],
  NONE: [],
  OTHER: ["TIN"],
};

const safeTrim = (value) => (typeof value === "string" ? value.trim() : "");

const parseMaybeJson = (value, fallback) => {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const ensureBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return fallback;
};

const buildAddressDocument = (address = {}) => ({
  type: address.type || "DEFAULT",
  label: safeTrim(address.label),
  line1: safeTrim(address.line1),
  line2: safeTrim(address.line2),
  city: safeTrim(address.city),
  state: safeTrim(address.state),
  country: safeTrim(address.country),
  pinCode: safeTrim(address.pinCode),
  stateCode: safeTrim(address.stateCode),
  gstStateCode: safeTrim(address.gstStateCode),
  taxType: safeTrim(address.taxType),
  taxNumber: safeTrim(address.taxNumber).toUpperCase(),
  countryId: address.countryId || null,
  stateId: address.stateId || null,
  isDefault: ensureBoolean(address.isDefault, false),
  isShipTo: ensureBoolean(address.isShipTo, false),
});

const normalizeAddress = (address = {}, index = 0) => {
  const normalizedType = ADDRESS_TYPES.includes(address.type) ? address.type : index === 0 ? "DEFAULT" : "SHIP_TO";

  return {
    type: normalizedType,
    label: safeTrim(address.label),
    line1: safeTrim(address.line1),
    line2: safeTrim(address.line2),
    city: safeTrim(address.city),
    state: safeTrim(address.state),
    country: safeTrim(address.country),
    pinCode: safeTrim(address.pinCode),
    stateCode: safeTrim(address.stateCode),
    gstStateCode: safeTrim(address.gstStateCode),
    taxType: safeTrim(address.taxType),
    taxNumber: safeTrim(address.taxNumber).toUpperCase(),
    countryId: address.countryId || null,
    stateId: address.stateId || null,
    isDefault: ensureBoolean(address.isDefault, index === 0 || normalizedType === "DEFAULT"),
    isShipTo: ensureBoolean(address.isShipTo, normalizedType === "SHIP_TO"),
  };
};

const normalizeTaxDetails = (payload = {}) => {
  const explicitTaxDetails = parseMaybeJson(payload.taxDetails, []);
  const normalizedExplicit = Array.isArray(explicitTaxDetails)
    ? explicitTaxDetails
        .map((item) => ({
          taxType: safeTrim(item?.taxType),
          taxNumber: safeTrim(item?.taxNumber).toUpperCase(),
          label: safeTrim(item?.label || item?.taxType),
        }))
        .filter((item) => item.taxType && item.taxNumber)
    : [];

  if (normalizedExplicit.length > 0) {
    return normalizedExplicit;
  }

  const derived = [];
  const knownTaxTypes = Object.keys(TAX_FIELD_MAP);

  for (const taxType of knownTaxTypes) {
    const fieldName = TAX_FIELD_MAP[taxType];
    const value = safeTrim(payload[fieldName]).toUpperCase();
    if (value) {
      derived.push({
        taxType,
        taxNumber: value,
        label: taxType,
      });
    }
  }

  if (payload.taxIdentifierType && payload.taxIdentificationNumber) {
    derived.push({
      taxType: safeTrim(payload.taxIdentifierType),
      taxNumber: safeTrim(payload.taxIdentificationNumber).toUpperCase(),
      label: safeTrim(payload.taxIdentifierType),
    });
  }

  const unique = new Map();
  derived.forEach((item) => {
    if (!item.taxType || !item.taxNumber) return;
    unique.set(`${item.taxType}:${item.taxNumber}`, item);
  });

  return Array.from(unique.values());
};

const derivePrimaryAddress = (addresses = []) =>
  addresses.find((address) => address.isDefault || address.type === "DEFAULT") ||
  addresses[0] ||
  normalizeAddress({}, 0);

const deriveShippingAddress = (addresses = [], primaryAddress = {}) =>
  addresses.find((address) => address.isShipTo || address.type === "SHIP_TO") || primaryAddress;

const syncLegacyTaxFields = (target, taxDetails) => {
  target.taxDetails = taxDetails;

  Object.values(TAX_FIELD_MAP).forEach((field) => {
    if (field in target) {
      target[field] = "";
    }
  });

  taxDetails.forEach((item) => {
    const fieldName = TAX_FIELD_MAP[item.taxType];
    if (fieldName && fieldName in target && !target[fieldName]) {
      target[fieldName] = item.taxNumber;
    }
  });

  const primaryTax = taxDetails[0];
  if ("taxIdentifierType" in target) {
    target.taxIdentifierType = primaryTax?.taxType || "";
  }
  if ("taxIdentificationNumber" in target) {
    target.taxIdentificationNumber = primaryTax?.taxNumber || "";
  }
};

export const normalizeCountryPayload = (payload = {}) => {
  const countryType = safeTrim(payload.countryType || "OTHER").toUpperCase();
  const configuredTaxTypes = parseMaybeJson(payload.taxTypes, []);
  const taxTypes = Array.isArray(configuredTaxTypes) && configuredTaxTypes.length > 0
    ? configuredTaxTypes.map((item) => safeTrim(item)).filter(Boolean)
    : DEFAULT_TAX_TYPES_BY_COUNTRY_TYPE[countryType] || DEFAULT_TAX_TYPES_BY_COUNTRY_TYPE.OTHER;

  // Handle embedded currency (new structure)
  let currency = payload.currency;
  if (!currency || typeof currency !== "object") {
    // Legacy support: currency was passed as separate fields
    currency = {
      currencyName: payload.currencyName || payload.countryName || "",
      currencyCode: payload.currencyCode || payload.countryCode || "",
      currencySymbol: payload.currencySymbol || "",
    };
  }

  // Handle tax config (new structure)
  let taxConfig = payload.taxConfig;
  if (!taxConfig || typeof taxConfig !== "object") {
    taxConfig = {
      taxSystem: payload.countryType || "OTHER",
      isGSTApplicable: payload.countryType === "GST",
      isRCMApplicable: payload.isRCMApplicable || false,
      isExportZeroRated: payload.isExportZeroRated || false,
    };
  }

  return {
    ...payload,
    countryName: safeTrim(payload.countryName),
    countryCode: safeTrim(payload.countryCode).toUpperCase(),
    dialCode: safeTrim(payload.dialCode),
    countryType,
    postalCodeLabel: safeTrim(payload.postalCodeLabel),
    postalCodeRegex: safeTrim(payload.postalCodeRegex),
    taxTypes,
    currency,
    taxConfig,
  };
};

export const normalizeStatePayload = (payload = {}) => ({
  ...payload,
  stateName: safeTrim(payload.stateName),
  stateCode: safeTrim(payload.stateCode).toUpperCase(),
  gstStateCode: safeTrim(payload.gstStateCode).toUpperCase(),
});

const resolveCurrencyDetails = async (primaryAddress = {}) => {
  let country = null;

  if (primaryAddress.countryId) {
    country = await findCountryByIdRepo(primaryAddress.countryId);
  } else if (primaryAddress.country) {
    country = await findCountryByNameRepo(primaryAddress.country);
  }

  if (!country?.currency) {
    return {
      currency: "INR",
      currencyName: "Indian Rupee",
      currencySymbol: "₹",
      countryMaster: country,
    };
  }

  return {
    currency: country.currency.currencyCode || "INR",
    currencyName: country.currency.currencyName || "Indian Rupee",
    currencySymbol: country.currency.currencySymbol || "₹",
    countryMaster: country,
  };
};

export const normalizeEntityPayload = async (payload = {}, entityType) => {
  const parsedAddresses = parseMaybeJson(payload.addresses, []);
  const sourceAddresses = Array.isArray(parsedAddresses) && parsedAddresses.length > 0
    ? parsedAddresses
    : [
        entityType === "client"
          ? {
              type: "DEFAULT",
              line1: payload.clientAddress,
              city: payload.clientCity,
              state: payload.clientState,
              country: payload.clientCountry,
              pinCode: payload.pinCode,
              stateCode: payload.stateCode,
              gstStateCode: payload.gstStateCode,
              isDefault: true,
            }
          : {
              type: "DEFAULT",
              line1: payload.registeredAddress,
              city: payload.city,
              state: payload.state,
              country: payload.country,
              pinCode: payload.pinCode,
              stateCode: payload.stateCode,
              gstStateCode: payload.gstStateCode,
              isDefault: true,
            },
      ];

  const addresses = sourceAddresses
    .map((address, index) => normalizeAddress(address, index))
    .filter((address) => address.line1 || address.city || address.state || address.country || address.pinCode);

  if (addresses.length === 0) {
    addresses.push(normalizeAddress({}, 0));
  }

  addresses.forEach((address, index) => {
    address.isDefault = index === 0 ? true : ensureBoolean(address.isDefault, false);
  });

  const primaryAddress = derivePrimaryAddress(addresses);
  const shippingAddress = deriveShippingAddress(addresses, primaryAddress);
  const additionalAddresses = addresses.filter((address) => address !== primaryAddress);
  const taxDetails = normalizeTaxDetails(payload);
  const currencyDetails = await resolveCurrencyDetails(primaryAddress);

  const normalized = {
    ...payload,
    addresses: additionalAddresses,
    defaultAddress: buildAddressDocument({ ...primaryAddress, isDefault: true }),
    additionalAddresses: additionalAddresses.map((address) => buildAddressDocument(address)),
    currency: currencyDetails.currency,
    currencyName: currencyDetails.currencyName,
    currencySymbol: currencyDetails.currencySymbol,
  };

  syncLegacyTaxFields(normalized, taxDetails);

  if (entityType === "client") {
    normalized.clientAddress = [primaryAddress.line1, primaryAddress.line2].filter(Boolean).join(", ");
    normalized.clientCity = primaryAddress.city;
    normalized.clientState = primaryAddress.state;
    normalized.clientCountry = primaryAddress.country || "India";
    normalized.pinCode = primaryAddress.pinCode;
    normalized.stateCode = primaryAddress.stateCode;
    normalized.gstStateCode = primaryAddress.gstStateCode;
    normalized.sameAsBilling = shippingAddress === primaryAddress;
  } else {
    normalized.registeredAddress = [primaryAddress.line1, primaryAddress.line2].filter(Boolean).join(", ");
    normalized.city = primaryAddress.city;
    normalized.state = primaryAddress.state;
    normalized.country = primaryAddress.country || "India";
    normalized.pinCode = primaryAddress.pinCode;
    normalized.stateCode = primaryAddress.stateCode;
    normalized.gstStateCode = primaryAddress.gstStateCode;
    normalized.billingAddress = undefined;
    normalized.shippingAddress = undefined;
  }

  return normalized;
};
