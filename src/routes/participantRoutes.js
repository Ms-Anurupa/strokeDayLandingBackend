import express from "express";
import { uploadVideo } from "../middleware/upload.js";
import {
  getAllParticipants,
  registerParticipant,
} from "../controllers/participantController.js";

const router = express.Router();

router.get("/getAllParticipants", getAllParticipants);
// router.get("/:id", getParticipantById);

router.post(
  "/participateRegister",
  uploadVideo.single("video"),
  registerParticipant
);

export default router;