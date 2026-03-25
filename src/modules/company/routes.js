import express from "express";
import {
  addCompanyController,
  addEmployeeController,
  employeesController,
  getAllCompanies,
} from "./controllers/companyController.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

// All routes are protected
router.use(protect);

// Create a new company
router.post("/", addCompanyController);

// Get all companies
router.get("/", getAllCompanies);

// Get all employees of a company
router.get("/:companyId/employees", employeesController);

// Add a new employee to a company
router.post("/:companyId/employees", addEmployeeController);

export default router;
