import {
  createCountryTaxRepo,
  getAllCountryTaxRepo,
  findCountryTaxByIdRepo,
  findCountryTaxByCodeRepo,
  updateCountryTaxRepo,
  deleteCountryTaxRepo,
} from "../repos/countryTaxRepo.js";
import { getCountryModel } from "../models/Country.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import AppError from "../../../utils/AppError.js";

const getUserAction = (req) => ({
  userId: req.user?._id,
  name: req.user?.name || `${req.user?.firstName || ""} ${req.user?.lastName || ""}`.trim() || "Unknown",
  email: req.user?.email || "Unknown",
});

// POST /api/masterData/countryTax
export const createCountryTaxController = async (req, res, next) => {
  try {
    const data = req.body;
    const userAction = getUserAction(req);

    if (!data.countryId) {
      throw new AppError(
        "countryId is required",
        400,
        "createCountryTaxController"
      );
    }

    // Fetch the actual country to ensure we get the right name and code
    const CountryModel = await getCountryModel();
    const country = await CountryModel.findById(data.countryId);
    
    if (!country) {
      throw new AppError("Invalid country selected.", 400, "createCountryTaxController");
    }

    const payload = {
      ...data,
      countryName: country.countryName,
      countryCode: country.countryCode,
      createdBy: userAction,
      updatedBy: userAction,
    };

    const record = await createCountryTaxRepo(payload);

    return res.status(201).json(
      new ApiResponse({
        success: true,
        data: record,
        message: "Country tax rate created successfully",
        statusCode: 201,
      })
    );
  } catch (err) {
    next(err);
  }
};

// GET /api/masterData/countryTax
export const getAllCountryTaxController = async (req, res, next) => {
  try {
    const list = await getAllCountryTaxRepo();
    return res.status(200).json(
      new ApiResponse({
        success: true,
        data: list,
        message: "Country tax rates fetched successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};

// GET /api/masterData/countryTax/:id
export const getCountryTaxByIdController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await findCountryTaxByIdRepo(id);
    if (!record) {
      throw new AppError("Country tax record not found", 404, "getCountryTaxByIdController");
    }
    return res.status(200).json(
      new ApiResponse({
        success: true,
        data: record,
        message: "Country tax record fetched successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};

// GET /api/masterData/countryTax/byCode/:countryCode
export const getCountryTaxByCodeController = async (req, res, next) => {
  try {
    const { countryCode } = req.params;
    const record = await findCountryTaxByCodeRepo(countryCode);
    // Return null data (not an error) if not found - frontend handles fallback
    return res.status(200).json(
      new ApiResponse({
        success: true,
        data: record || null,
        message: record
          ? "Country tax record found"
          : "No tax record for this country",
      })
    );
  } catch (err) {
    next(err);
  }
};

// PUT /api/masterData/countryTax/:id
export const updateCountryTaxController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const userAction = getUserAction(req);

    const existing = await findCountryTaxByIdRepo(id);
    if (!existing) {
      throw new AppError("Country tax record not found", 404, "updateCountryTaxController");
    }

    const payload = { ...data, updatedBy: userAction };
    const updated = await updateCountryTaxRepo(id, payload, userAction);
    
    return res.status(200).json(
      new ApiResponse({
        success: true,
        data: updated,
        message: "Country tax rate updated successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};

// DELETE /api/masterData/countryTax/:id
export const deleteCountryTaxController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await findCountryTaxByIdRepo(id);
    if (!existing) {
      throw new AppError("Country tax record not found", 404, "deleteCountryTaxController");
    }

    await deleteCountryTaxRepo(id);
    return res.status(200).json(
      new ApiResponse({
        success: true,
        message: "Country tax rate deleted successfully",
      })
    );
  } catch (err) {
    next(err);
  }
};
