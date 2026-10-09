import express from "express";
import {
    adminLogin,
    getCurrentAdmin,
    getDashboard,
    listRegistrations,
    getRegistration,
    updateRegistration,
    deleteRegistration,
    exportRegistrationList,
} from "../controllers/adminController.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public admin authentication.
router.post("/login", adminLogin);

// All routes below require a valid admin token.
router.use(requireAdmin);

router.get("/me", getCurrentAdmin);
router.get("/dashboard", getDashboard);

// Participant management.
router.get("/participants", (req, res, next) => {
    req.params.type = "participants";
    next();
}, listRegistrations);

router.get("/participants/export", (req, res, next) => {
    req.params.type = "participants";
    next();
}, exportRegistrationList);

router.get("/participants/:id", (req, res, next) => {
    req.params.type = "participants";
    next();
}, getRegistration);

router.patch("/participants/:id", (req, res, next) => {
    req.params.type = "participants";
    next();
}, updateRegistration);

router.delete("/participants/:id", (req, res, next) => {
    req.params.type = "participants";
    next();
}, deleteRegistration);

// Attendee management.
router.get("/attendees", (req, res, next) => {
    req.params.type = "attendees";
    next();
}, listRegistrations);

router.get("/attendees/export", (req, res, next) => {
    req.params.type = "attendees";
    next();
}, exportRegistrationList);

router.get("/attendees/:id", (req, res, next) => {
    req.params.type = "attendees";
    next();
}, getRegistration);

router.patch("/attendees/:id", (req, res, next) => {
    req.params.type = "attendees";
    next();
}, updateRegistration);

router.delete("/attendees/:id", (req, res, next) => {
    req.params.type = "attendees";
    next();
}, deleteRegistration);

export default router;