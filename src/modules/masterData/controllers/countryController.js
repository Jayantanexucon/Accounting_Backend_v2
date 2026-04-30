import { createCountryRepo, findCountryByIdRepo, getAllCountriesRepo, updateCountryRepo, deleteCountryRepo, findCountryByCodeRepo } from "../repos/countryRepo.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";

export const createCountryController = async (req, res, next) => {
  try {
    const { countryName, countryCode, dialCode, currency } = req.body;
    const userId = req.user?._id;

    if (!countryName || !countryCode) {
      throw new AppError("Country name and code are required", 400, "createCountryController");
    }

    const country = await createCountryRepo({
      countryName,
      countryCode,
      dialCode,
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
    const updateData = req.body;
    const userId = req.user?._id;

    const oldCountry = await findCountryByIdRepo(countryId);
    if (!oldCountry) {
      throw new AppError("Country not found", 404, "updateCountryController");
    }

    const country = await updateCountryRepo(countryId, {
      ...updateData,
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
