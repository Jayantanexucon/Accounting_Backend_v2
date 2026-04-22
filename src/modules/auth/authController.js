import { createUserRepo, findUserRepo, findUserByIdRepo, updateUserRepo } from "../user/repos/userRepo.js";
import { saveRefreshToken, findRefreshTokenDoc, revokeRefreshToken, rotateRefreshToken } from "../user/repos/tokenRepo.js";
import { createAccessToken, createRefreshTokenString, verifyRefreshToken, sendRefreshTokenCookie, clearRefreshTokenCookie  } from "./authService.js";
// import { } from "../../services/authService.js";
import AppError from "../../utils/AppError.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { createAuditLog } from "../../utils/createAuditLog.js";
import { findCompaniesRepo } from "../company/repos/companyRepo.js";
import { givePrivilegeUtil } from "../../utils/userUtil.js";

const COOKIE_NAME = process.env.REFRESH_TOKEN_COOKIE_NAME || "jid";

export const registerUserController = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      throw new AppError("Name, email, and password are required", 400);
    }
    const existingUser = await findUserRepo({ email });
    if (existingUser) {
      throw new AppError("User already exists", 409);
    }
    const user = await createUserRepo({
      name,
      email,
      password,
      role: role || "user",
      permissions: [],
    });
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshTokenString(user);
    await saveRefreshToken({
      token: refreshToken,
      userId: user._id,
      createdByIp: req.ip,
    });
    sendRefreshTokenCookie(res, refreshToken);
    await createAuditLog({
      module: "AUTH",
      entityId: user._id.toString(),
      actionType: "USER_REGISTERED",
      logs: [{ field: "user", oldValue: null, newValue: { name, email, role } }],
      userId: user._id.toString(),
    });
    return new ApiResponse({
      message: "User registered successfully",
      statusCode: 201,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        accessToken,
      },
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const loginUserController = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }
    const user = await findUserRepo({ email });
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError("Invalid email or password", 401);
    }
    if (user.isBlocked) {
      throw new AppError("Your account has been blocked by admin", 403);
    }
    const companies = await findCompaniesRepo({
      $or: [{ owner: user._id.toString() }, { "employees.userId": user._id.toString() }],
    });
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshTokenString(user);
    await saveRefreshToken({
      token: refreshToken,
      userId: user._id,
      createdByIp: req.ip,
    });
    sendRefreshTokenCookie(res, refreshToken);
    await createAuditLog({
      module: "AUTH",
      entityId: user._id.toString(),
      actionType: "USER_LOGIN",
      logs: [{ field: "login", oldValue: null, newValue: email }],
      userId: user._id.toString(),
    });
    return new ApiResponse({
      message: "Login successful",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
        },
        accessToken,
        companies,
      },
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const refreshTokenHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken || req.headers["x-refresh-token"];
    if (!token) {
      throw new AppError("Refresh token missing", 401);
    }
    const tokenDoc = await findRefreshTokenDoc(token);
    if (!tokenDoc || !tokenDoc.isActive) {
      throw new AppError("Refresh token expired or revoked", 401);
    }
    const decoded = verifyRefreshToken(token);
    const user = await findUserByIdRepo(decoded.id);
    if (!user || user.isBlocked) {
      throw new AppError("User not found or blocked", 401);
    }
    const newRefreshToken = createRefreshTokenString(user);
    await rotateRefreshToken(tokenDoc, newRefreshToken, req.ip);
    const newAccessToken = createAccessToken(user);
    sendRefreshTokenCookie(res, newRefreshToken);
    return new ApiResponse({
      message: "Token refreshed",
      data: { accessToken: newAccessToken },
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const logoutController = async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      const tokenDoc = await findRefreshTokenDoc(token);
      if (tokenDoc) {
        await revokeRefreshToken(tokenDoc, req.ip, "logout");
      }
    }
    clearRefreshTokenCookie(res);
    await createAuditLog({
      module: "AUTH",
      entityId: req.user?._id?.toString(),
      actionType: "USER_LOGOUT",
      logs: [{ field: "logout", oldValue: "active", newValue: "logged_out" }],
      userId: req.user?._id?.toString(),
    });
    return new ApiResponse({
      message: "Logged out successfully",
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const accessTokenController = async (req, res, next) => {
  try {
    const user = await findUserByIdRepo(req.user._id);
    if (!user) throw new AppError("User not found", 404);
    if (user.isBlocked) {
      throw new AppError("Your account has been blocked", 403);
    }
    const company = await findCompaniesRepo({
      $or: [{ owner: user._id.toString() }, { "employees.userId": user._id.toString() }],
    });
    const accessToken = createAccessToken(user);
    return new ApiResponse({
      message: "Access token valid",
      data: {
        user,
        accessToken,
        company,
      },
    }).send(res);
  } catch (error) {
    next(error);
  }
};

export const fetchMe = async (req, res, next) => {
  try {
    const azureEmail = (
      req.user?.preferred_username ||
      req.user?.email ||
      req.user?.upn ||
      ""
    ).toLowerCase();
    const azureObjectId = req.user?.oid;

    let user = null;

    if (azureObjectId) {
      user = await findUserRepo({ azureObjectId });
    }

    if (!user && azureEmail) {
      user = await findUserRepo({ email: azureEmail });
    }

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.isBlocked) {
      throw new AppError("Your account has been blocked", 403);
    }

    if (azureObjectId && !user.azureObjectId) {
      user = await updateUserRepo(user._id, { azureObjectId });
    }

    const selectedCompanyId = req.cookies?.AC_CMP;
    const allCompanies = await findCompaniesRepo({});

    const resolveSelectedCompany = (companies) => {
      if (!Array.isArray(companies) || companies.length === 0) return null;

      // Priority 1: Use cookie-based selection if available
      if (selectedCompanyId) {
        const matchedCompany = companies.find(
          (company) => company?._id?.toString() === selectedCompanyId
        );
        if (matchedCompany) {
          console.log(`✅ Resolved company from cookie: ${matchedCompany.name}`);
          return matchedCompany;
        }
      }

      // Priority 2: If single company, return it
      if (companies.length === 1) {
        console.log(`✅ Resolved company (single): ${companies[0].name}`);
        return companies[0];
      }

      // Priority 3: Multiple companies, no cookie - return first company as default
      console.log(`⚠️  Multiple companies found, no valid selection. Defaulting to first: ${companies[0].name}`);
      return companies[0];
    };

    const accessToken = createAccessToken(user);

    if (user.role === "superAdmin") {
      return res.json({
        user,
        accessToken,
        companies: allCompanies,
        selectedCompany: resolveSelectedCompany(allCompanies),
      });
    }

    // Primary: Filter by permissions
    const allowedCompanyIds = new Set(
      user?.permissions
        ?.map((p) => p.company?._id || p.companyId || p.company)
        .filter(Boolean)
        .map((companyId) => companyId.toString())
    );

    let companies = allCompanies.filter((company) =>
      allowedCompanyIds.has(company?._id?.toString())
    );

    // Fallback: If no companies from permissions, use direct ownership/employee status
    if (companies.length === 0) {
      companies = allCompanies.filter((company) => {
        const isOwner = company?.owner?.toString() === user._id.toString();
        const isEmployee = company?.employees?.some(
          (emp) => emp?.user?.toString() === user._id.toString() || emp?.userId?.toString() === user._id.toString()
        );
        return isOwner || isEmployee;
      });

      // Log the fallback for debugging
      console.log(`⚠️  User ${user._id} has no permission-based companies. Using ownership/employee fallback:`, companies.length);
    }

    return res.json({
      user,
      accessToken,
      companies,
      selectedCompany: resolveSelectedCompany(companies),
    });
  } catch (error) {
    next(error);
  }
};

export const azureSSOCallback = async (req, res, next) => {
  try {
    const azureUser = req.user;
    let user = await findUserRepo({ azureObjectId: azureUser.oid });
    if (!user) {
      user = await createUserRepo({
        email: (azureUser.preferred_username || azureUser.email).toLowerCase(),
        name: azureUser.name,
        azureObjectId: azureUser.oid,
        role: "user",
        permissions: [],
      });
    }
    if (user.isBlocked) {
      throw new AppError("Your account has been blocked", 403);
    }
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshTokenString(user);
    await saveRefreshToken({
      token: refreshToken,
      userId: user._id,
      createdByIp: req.ip,
    });
    sendRefreshTokenCookie(res, refreshToken);
    await createAuditLog({
      module: "AUTH",
      entityId: user._id.toString(),
      actionType: "AZURE_SSO_LOGIN",
      logs: [{ field: "azureSSO", oldValue: null, newValue: user.email }],
      userId: user._id.toString(),
    });
    return new ApiResponse({
      message: "Azure SSO login successful",
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          azureObjectId: user.azureObjectId,
        },
        accessToken,
      },
    }).send(res);
  } catch (error) {
    next(error);
  }
};
