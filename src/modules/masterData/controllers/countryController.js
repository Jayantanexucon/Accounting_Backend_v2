import { createCountryRepo, findCountryByIdRepo, getAllCountriesRepo, updateCountryRepo, deleteCountryRepo, findCountryByCodeRepo } from "../repos/countryRepo.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import { normalizeCountryPayload } from "../utils/entityMasterData.js";

// Helper to extract and validate inline currency object
const resolveCurrencyInline = (payload) => {
  // If currency is already an object with required fields, use it directly
  if (payload.currency && typeof payload.currency === "object" && payload.currency.currencyCode) {
    return {
      currencyName: payload.currency.currencyName?.trim() || payload.currency.currencyCode,
      currencyCode: payload.currency.currencyCode?.trim()?.toUpperCase(),
      currencySymbol: payload.currency.currencySymbol?.trim() || "",
    };
  }

  // If currency is a string (legacy support), return null to use default
  if (typeof payload.currency === "string") {
    return null;
  }

  return null;
};

export const createCountryController = async (req, res, next) => {
  try {
    const normalizedPayload = normalizeCountryPayload(req.body);
    const { countryName, countryCode } = normalizedPayload;
    const userId = req.user?._id;

    if (!countryName || !countryCode) {
      throw new AppError("Country name and code are required", 400, "createCountryController");
    }

    // Extract inline currency or use default based on country code
    let currency = resolveCurrencyInline(normalizedPayload);
    
    // If no currency provided, use default based on country code
    if (!currency) {
      const defaults = {
        IN: { currencyName: "Indian Rupee", currencyCode: "INR", currencySymbol: "₹" },
        US: { currencyName: "US Dollar", currencyCode: "USD", currencySymbol: "$" },
        GB: { currencyName: "British Pound", currencyCode: "GBP", currencySymbol: "£" },
      };
      currency = defaults[countryCode.toUpperCase()] || { 
        currencyName: countryName, 
        currencyCode: countryCode.toUpperCase(), 
        currencySymbol: "" 
      };
    }

    const country = await createCountryRepo({
      ...normalizedPayload,
      currency,
      createdBy: userId,
      updatedBy: userId,
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: country._id,
      actionType: "COUNTRY_CREATED",
      logs: [
        {
          field: "country",
          oldValue: null,
          newValue: { countryName, countryCode },
        },
      ],
      userId,
    });

    return res.status(201).json(
      new ApiResponse({
        message: "Country created successfully",
        data: country,
        statusCode: 201,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getAllCountriesController = async (req, res, next) => {
  try {
    const countries = await getAllCountriesRepo();
    return res.status(200).json(
      new ApiResponse({
        message: "Countries fetched successfully",
        data: countries,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getCountryByIdController = async (req, res, next) => {
  try {
    const { countryId } = req.params;

    const country = await findCountryByIdRepo(countryId);
    if (!country) {
      throw new AppError("Country not found", 404, "getCountryByIdController");
    }

    return res.status(200).json(
      new ApiResponse({
        message: "Country fetched successfully",
        data: country,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateCountryController = async (req, res, next) => {
  try {
    const { countryId } = req.params;
    const updateData = normalizeCountryPayload(req.body);
    const userId = req.user?._id;

    const oldCountry = await findCountryByIdRepo(countryId);
    if (!oldCountry) {
      throw new AppError("Country not found", 404, "updateCountryController");
    }

    // Extract inline currency or keep existing
    const currency = resolveCurrencyInline(updateData) || oldCountry.currency;

    const country = await updateCountryRepo(countryId, {
      ...updateData,
      currency,
      updatedBy: userId,
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: country._id,
      actionType: "COUNTRY_UPDATED",
      logs: [
        {
          field: "country",
          oldValue: { countryName: oldCountry.countryName },
          newValue: { countryName: country.countryName },
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        message: "Country updated successfully",
        data: country,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const deleteCountryController = async (req, res, next) => {
  try {
    const { countryId } = req.params;
    const userId = req.user?._id;

    const country = await findCountryByIdRepo(countryId);
    if (!country) {
      throw new AppError("Country not found", 404, "deleteCountryController");
    }

    await deleteCountryRepo(countryId);

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: countryId,
      actionType: "COUNTRY_DELETED",
      logs: [
        {
          field: "country",
          oldValue: { countryName: country.countryName },
          newValue: null,
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        message: "Country deleted successfully",
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};
