import { findUserByIdRepo, getAllUsersRepo, updateUserRepo, findUserRepo } from "../repos/userRepo.js";
import AppError from "../../../utils/AppError.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import { findCompaniesRepo, createCompanyRepo, updateCompanyRepo } from "../../company/repos/companyRepo.js";

// ✅ Get all users (SuperAdmin only)
export const getAllUsersController = async (req, res, next) => {
  try {
    const users = await getAllUsersRepo();
    return new ApiResponse({
      message: "All users fetched successfully",
      data: users,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// ✅ Create user by SuperAdmin (NO password)
export const createUserBySuperAdmin = async (req, res, next) => {
  try {
    const { email, name, role = "user" } = req.body;

    if (!email || !name) {
      throw new AppError("Email and name are required", 400);
    }

    const existingUser = await findUserRepo({ email });
    if (existingUser) {
      throw new AppError("User already exists", 409);
    }

    const user = await findUserByIdRepo(req.user._id);
    if (user.role !== "superAdmin") {
      throw new AppError("Only superAdmin can create users", 403);
    }

    const newUser = await createUserRepo({
      email: email.toLowerCase(),
      name,
      role,
      permissions: [],
      createdBy: req.user._id.toString(),
    });

    await createAuditLog({
      module: "AUTH",
      entityId: newUser._id.toString(),
      actionType: "USER_CREATED_BY_ADMIN",
      logs: [{ field: "user", oldValue: null, newValue: { name, email, role } }],
      userId: req.user._id.toString(),
    });

    return new ApiResponse({
      statusCode: 201,
      message: "User created successfully",
      data: newUser,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// ✅ Edit user by SuperAdmin
export const editUserBySuperAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { email, name, role, isBlocked } = req.body;

    const user = await findUserByIdRepo(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.role === "superAdmin") {
      throw new AppError("SuperAdmin account cannot be modified", 403);
    }

    const updates = {};
    const logs = [];

    if (email) {
      const normalizedEmail = email.toLowerCase();
      const emailExists = await findUserRepo({ email: normalizedEmail });

      if (emailExists && emailExists._id.toString() !== userId) {
        throw new AppError("Email already in use", 409);
      }

      updates.email = normalizedEmail;
      logs.push({
        field: "email",
        oldValue: user.email,
        newValue: normalizedEmail,
      });
    }

    if (name) {
      updates.name = name;
      logs.push({
        field: "name",
        oldValue: user.name,
        newValue: name,
      });
    }

    if (role) {
      updates.role = role;
      logs.push({
        field: "role",
        oldValue: user.role,
        newValue: role,
      });
    }

    if (typeof isBlocked === "boolean") {
      updates.isBlocked = isBlocked;
      updates.blockedAt = isBlocked ? new Date() : null;
      logs.push({
        field: "isBlocked",
        oldValue: user.isBlocked,
        newValue: isBlocked,
      });
    }

    updates.updatedBy = req.user._id.toString();

    const updatedUser = await updateUserRepo(userId, updates);

    await createAuditLog({
      module: "AUTH",
      entityId: userId,
      actionType: "USER_UPDATED_BY_ADMIN",
      logs,
      userId: req.user._id.toString(),
    });

    return new ApiResponse({
      message: "User updated successfully",
      data: updatedUser,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// ✅ Update user permissions
export const updateUserPermissions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { permissions, companyId } = req.body;

    if (!companyId) {
      throw new AppError("companyId is required", 400);
    }

    if (!Array.isArray(permissions)) {
      throw new AppError("Permissions must be an array", 400);
    }

    const user = await findUserByIdRepo(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.role === "superAdmin") {
      throw new AppError("SuperAdmin permissions cannot be modified", 403);
    }

    // Remove ALL existing permissions for this company
    user.permissions = user.permissions.filter(
      (perm) => perm.companyId?.toString() !== companyId
    );

    // Add new permissions if array is not empty
    if (permissions.length > 0) {
      user.permissions.push(...permissions);
    }

    await user.save();

    await createAuditLog({
      module: "AUTH",
      entityId: userId,
      actionType:
        permissions.length === 0
          ? "COMPANY_PERMISSIONS_REMOVED"
          : "USER_PERMISSIONS_UPDATED",
      logs: [
        {
          field: "permissions",
          oldValue: "Previous permissions",
          newValue: permissions,
        },
      ],
      userId: req.user._id.toString(),
    });

    const updatedUser = await findUserByIdRepo(userId);

    return new ApiResponse({
      message:
        permissions.length === 0
          ? "Company permissions removed"
          : "Permissions updated successfully",
      data: updatedUser,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// ✅ Get all companies for user
export const getAllCompaniesForUser = async (req, res, next) => {
  try {
    const user = req.user;
    const allCompanies = await findCompaniesRepo({});

    if (user.role === "superAdmin") {
      return res.status(200).json(
        new ApiResponse({
          statusCode: 200,
          data: allCompanies,
          message: "All companies fetched",
        })
      );
    }

    const allowedCompanyIds = new Set(
      user?.permissions?.map((p) => p.companyId?.toString() || p.companyId)
    );

    const companies = allCompanies.filter((company) =>
      allowedCompanyIds.has(company._id.toString())
    );

    return res.status(200).json(
      new ApiResponse({
        statusCode: 200,
        data: companies,
        message: "Fetched all accessed companies",
      })
    );
  } catch (error) {
    next(error);
  }
};

// ✅ Create company by SuperAdmin
export const createCompanyBySuperAdmin = async (req, res, next) => {
  try {
    const { name, registeredAddress, taxDetails, bankDetails } = req.body;

    if (!name) {
      throw new AppError("Company name is required", 400);
    }

    const existing = await findCompaniesRepo({ name });
    if (existing.length) {
      throw new AppError("Company with this name already exists", 409);
    }

    const companyPayload = {
      name,
      registeredAddress,
      taxDetails,
      bankDetails,
      owner: req.user._id.toString(),
      employees: [],
    };

    const company = await createCompanyRepo(companyPayload);

    await createAuditLog({
      module: "COMPANY",
      entityId: company._id.toString(),
      actionType: "COMPANY_CREATED",
      logs: [{ field: "company", oldValue: null, newValue: { name } }],
      userId: req.user._id.toString(),
    });

    return new ApiResponse({
      statusCode: 201,
      message: "Company created successfully",
      data: {
        _id: company._id,
        name: company.name,
      },
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// ✅ Update company by SuperAdmin
export const updateCompanyBySuperAdmin = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const updates = req.body;

    if (!companyId) {
      throw new AppError("Company ID is required", 400);
    }

    const companies = await findCompaniesRepo({ _id: companyId });
    if (!companies.length) {
      throw new AppError("Company not found", 404);
    }

    const company = companies[0];

    if (company.owner.toString() !== req.user._id.toString()) {
      throw new AppError("Not authorized to update this company", 403);
    }

    const auditLogs = [];
    Object.keys(updates).forEach((field) => {
      auditLogs.push({
        field,
        oldValue: company[field],
        newValue: updates[field],
      });
    });

    updates.lastModifiedBy = req.user._id.toString();
    const updated = await updateCompanyRepo(companyId, updates);

    await createAuditLog({
      module: "COMPANY",
      entityId: companyId,
      actionType: "COMPANY_UPDATED",
      logs: auditLogs,
      userId: req.user._id.toString(),
    });

    return new ApiResponse({
      message: "Company updated successfully",
      data: {
        _id: updated._id,
        name: updated.name,
      },
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// ✅ Get company by ID for user
export const getCompanyForUserById = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const user = req.user;

    if (user.role === "superAdmin") {
      const companies = await findCompaniesRepo({ _id: companyId });
      if (!companies.length) {
        throw new AppError("Company not found", 404);
      }

      return new ApiResponse({
        statusCode: 200,
        message: "Company fetched successfully",
        data: companies[0],
      }).send(res);
    }

    if (!companyId) {
      throw new AppError("Company ID is required", 400);
    }

    const hasAccess = user.permissions?.some((perm) => {
      const permCompanyId =
        typeof perm.companyId === "object"
          ? perm.companyId?._id?.toString()
          : perm.companyId?.toString();

      return permCompanyId === companyId?.toString();
    });

    if (!hasAccess) {
      throw new AppError("You do not have access to this company", 403);
    }

    const companies = await findCompaniesRepo({ _id: companyId });

    if (!companies.length) {
      throw new AppError("Company not found", 404);
    }

    return new ApiResponse({
      statusCode: 200,
      message: "Company fetched successfully",
      data: companies[0],
    }).send(res);
  } catch (error) {
    next(error);
  }
};