import { createCurrencyRepo, findCurrencyByIdRepo, getAllCurrenciesRepo, updateCurrencyRepo, deleteCurrencyRepo, findCurrencyByCodeRepo } from "../repos/currencyRepo.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";

export const createCurrencyController = async (req, res, next) => {
  try {
    const { currencyName, currencyCode, currencySymbol } = req.body;
    const userId = req.user?._id;

    if (!currencyName || !currencyCode) {
      throw new AppError("Currency name and code are required", 400, "createCurrencyController");
    }

    const currency = await createCurrencyRepo({
      currencyName,
      currencyCode,
      currencySymbol,
      createdBy: userId,
      updatedBy: userId,
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: currency._id,
      actionType: "CURRENCY_CREATED",
      logs: [
        {
          field: "currency",
          oldValue: null,
          newValue: { currencyName, currencyCode },
        },
      ],
      userId,
    });

    return res.status(201).json(
      new ApiResponse({
        message: "Currency created successfully",
        data: currency,
        statusCode: 201,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getAllCurrenciesController = async (req, res, next) => {
  try {
    const currencies = await getAllCurrenciesRepo();

    return res.status(200).json(
      new ApiResponse({
        message: "Currencies fetched successfully",
        data: currencies,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getCurrencyByIdController = async (req, res, next) => {
  try {
    const { currencyId } = req.params;

    const currency = await findCurrencyByIdRepo(currencyId);
    if (!currency) {
      throw new AppError("Currency not found", 404, "getCurrencyByIdController");
    }

    return res.status(200).json(
      new ApiResponse({
        message: "Currency fetched successfully",
        data: currency,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateCurrencyController = async (req, res, next) => {
  try {
    const { currencyId } = req.params;
    const updateData = req.body;
    const userId = req.user?._id;

    const oldCurrency = await findCurrencyByIdRepo(currencyId);
    if (!oldCurrency) {
      throw new AppError("Currency not found", 404, "updateCurrencyController");
    }

    const currency = await updateCurrencyRepo(currencyId, {
      ...updateData,
      updatedBy: userId,
    });

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: currency._id,
      actionType: "CURRENCY_UPDATED",
      logs: [
        {
          field: "currency",
          oldValue: { currencyName: oldCurrency.currencyName },
          newValue: { currencyName: currency.currencyName },
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        message: "Currency updated successfully",
        data: currency,
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const deleteCurrencyController = async (req, res, next) => {
  try {
    const { currencyId } = req.params;
    const userId = req.user?._id;

    const currency = await findCurrencyByIdRepo(currencyId);
    if (!currency) {
      throw new AppError("Currency not found", 404, "deleteCurrencyController");
    }

    await deleteCurrencyRepo(currencyId);

    await createAuditLog({
      module: "MASTER_DATA",
      entityId: currencyId,
      actionType: "CURRENCY_DELETED",
      logs: [
        {
          field: "currency",
          oldValue: { currencyName: currency.currencyName },
          newValue: null,
        },
      ],
      userId,
    });

    return res.status(200).json(
      new ApiResponse({
        message: "Currency deleted successfully",
        statusCode: 200,
      })
    );
  } catch (error) {
    next(error);
  }
};
