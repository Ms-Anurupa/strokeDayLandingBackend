import express from "express";
import { registerAttendee } from "../controllers/attendeeController.js";

const router = express.Router();

router.post("/register", registerAttendee);

export default router;