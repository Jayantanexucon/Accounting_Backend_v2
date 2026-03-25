import mongoose from "mongoose";
import AppError from "../../../utils/AppError.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { createAuditLog } from "../../../utils/createAuditLog.js";
import { findCompaniesRepo, createCompanyRepo, findCompanyByIdRepo, updateCompanyRepo } from "../repos/companyRepo.js";
import { findUserByIdRepo, updateUserRepo } from "../../user/repos/userRepo.js";

// ✅ Add Company
export const addCompanyController = async (req, res, next) => {
  try {
    const { name, owner } = req.body;

    if (!name) {
      throw new AppError("Company name is required", 400);
    }

    const company = await createCompanyRepo({
      name,
      owner: owner || req.user._id.toString(),
      employees: [],
    });

    await createAuditLog({
      module: "COMPANY",
      entityId: company._id.toString(),
      actionType: "COMPANY_CREATED",
      logs: [
        {
          field: "company",
          oldValue: null,
          newValue: {
            name: company.name,
            owner: company.owner,
          },
        },
      ],
      userId: req.user?._id?.toString(),
    });

    return new ApiResponse({
      message: "Company created successfully",
      data: company,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// ✅ Get Company Employees
export const employeesController = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const company = await findCompanyByIdRepo(companyId);

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    return new ApiResponse({
      message: "Employees fetched successfully",
      data: company?.employees || [],
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// ✅ Add Employee to Company
export const addEmployeeController = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { userId, role, privilege = {} } = req.body;

    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    const company = await findCompanyByIdRepo(companyId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    // Check if employee already exists
    const employeeExists = company.employees.some(
      (emp) => emp.userId === userId.toString()
    );

    if (employeeExists) {
      // Update existing employee
      const employee = company.employees.find(
        (emp) => emp.userId === userId.toString()
      );
      employee.role = role || employee.role;
      employee.privilege = privilege || employee.privilege;
    } else {
      // Add new employee
      company.employees.push({
        userId: userId.toString(),
        role,
        privilege,
      });
    }

    await company.save();

    await createAuditLog({
      module: "COMPANY",
      entityId: companyId,
      actionType: employeeExists ? "EMPLOYEE_UPDATED" : "EMPLOYEE_ADDED",
      logs: [
        {
          field: "employee",
          oldValue: null,
          newValue: {
            userId: userId.toString(),
            role,
            privilege,
          },
        },
      ],
      userId: req.user?._id?.toString(),
    });

    return new ApiResponse({
      message: "Employee added/updated successfully",
      data: company.employees,
    }).send(res);
  } catch (error) {
    next(error);
  }
};

// ✅ Get All Companies
export const getAllCompanies = async (req, res, next) => {
  try {
    const data = await findCompaniesRepo({});

    return res.status(200).json(
      new ApiResponse({
        statusCode: 200,
        data,
        message: "Fetched all companies successfully",
      })
    );
  } catch (error) {
    next(error);
  }
};
