import express from "express";
import { uploadVideo } from "../middleware/upload.js";
import {
  registerParticipant,
} from "../controllers/participantController.js";

const router = express.Router();

router.post(
  "/participateRegister",
  uploadVideo.single("video"),
  registerParticipant
);

export default router;