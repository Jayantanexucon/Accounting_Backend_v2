import { createCountryRepo, findCountryByIdRepo, getAllCountriesRepo, updateCountryRepo, deleteCountryRepo, findCountryByCodeRepo } from "../repos/countryRepo.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import { normalizeCountryPayload } from "../utils/entityMasterData.js";
import { createCurrencyRepo, findCurrencyByCodeRepo } from "../repos/currencyRepo.js";

const resolveCurrencyReference = async (payload, userId) => {
  if (payload.currency && typeof payload.currency !== "object") {
    return payload.currency;
  }

  const currencyPayload = payload.currencyDetails || payload.currency;
  if (!currencyPayload || typeof currencyPayload !== "object") {
    return null;
  }

  const currencyName = currencyPayload.currencyName?.trim();
  const currencyCode = currencyPayload.currencyCode?.trim()?.toUpperCase();
  const currencySymbol = currencyPayload.currencySymbol?.trim() || "";

  if (!currencyName || !currencyCode) {
    throw new AppError("Currency name and currency code are required", 400, "resolveCurrencyReference");
  }

  const existingCurrency = await findCurrencyByCodeRepo(currencyCode);
  if (existingCurrency) {
    return existingCurrency._id;
  }

  const createdCurrency = await createCurrencyRepo({
    currencyName,
    currencyCode,
    currencySymbol,
    createdBy: userId,
    updatedBy: userId,
  });

  return createdCurrency._id;
};

export const createCountryController = async (req, res, next) => {
  try {
    const normalizedPayload = normalizeCountryPayload(req.body);
    const { countryName, countryCode } = normalizedPayload;
    const userId = req.user?._id;

    if (!countryName || !countryCode) {
      throw new AppError("Country name and code are required", 400, "createCountryController");
    }

    const currency = await resolveCurrencyReference(normalizedPayload, userId);

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

    const currency = await resolveCurrencyReference(updateData, userId);

    const country = await updateCountryRepo(countryId, {
      ...updateData,
      ...(currency ? { currency } : {}),
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
