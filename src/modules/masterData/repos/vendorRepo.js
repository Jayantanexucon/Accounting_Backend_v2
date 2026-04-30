import { getVendorModel } from "../models/Vendor.js";
import AppError from "../../../utils/AppError.js";

export const createVendorRepo = async (data) => {
  try {
    const Vendor = await getVendorModel();
    return await Vendor.create(data);
  } catch (error) {
    const statusCode = error.code === 11000 ? 409 : 500;
    throw new AppError(error.message, statusCode, "createVendorRepo");
  }
};

export const findVendorByIdRepo = async (id) => {
  try {
    const Vendor = await getVendorModel();
    return await Vendor.findById(id);
  } catch (error) {
    throw new AppError(error.message, 500, "findVendorByIdRepo");
  }
};

export const updateVendorRepo = async (id, data) => {
  try {
    const Vendor = await getVendorModel();
    return await Vendor.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  } catch (error) {
    throw new AppError(error.message, 500, "updateVendorRepo");
  }
};

export const deleteVendorRepo = async (id) => {
  try {
    const Vendor = await getVendorModel();
    return await Vendor.findByIdAndUpdate(id, { isActive: false }, { new: true });
  } catch (error) {
    throw new AppError(error.message, 500, "deleteVendorRepo");
  }
};

export const completeVendorRepo = async (id) => {
  try {
    const Vendor = await getVendorModel();
    return await Vendor.findByIdAndUpdate(id, { status: "Completed" }, { new: true });
  } catch (error) {
    throw new AppError(error.message, 500, "completeVendorRepo");
  }
};

export const getPaginatedVendorsRepo = async ({ companyId, page, limit }) => {
  try {
    const Vendor = await getVendorModel();
    const skip = (page - 1) * limit;
    const query = { companyId };

    const totalCount = await Vendor.countDocuments(query);

    const vendors = await Vendor.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return {
      vendors,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  } catch (error) {
    throw new AppError(error.message, 500, "getPaginatedVendorsRepo");
  }
};

export const searchVendorsRepo = async (companyId, searchTerm, filters = {}) => {
  try {
    const Vendor = await getVendorModel();
    const query = { companyId, isActive: true };

    if (searchTerm) {
      query.$or = [
        { vendorName: { $regex: searchTerm, $options: "i" } },
        { vendorCode: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
      ];
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.serviceType) {
      query.serviceType = filters.serviceType;
    }

    return await Vendor.find(query).sort({ createdAt: -1 });
  } catch (error) {
    throw new AppError(error.message, 500, "searchVendorsRepo");
  }
};
