import { z } from "zod";
import { prisma } from "../config/prisma.js";
import fs from "fs";
import path from "path";
import { videoMimeType } from "../middleware/upload.js";

function generateRegistrationNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);

  return `GGT26-${timestamp}${random}`;
}

// The landing page uses "stand-up-comedy"; the database enum uses "stand_up_comedy".
const CATEGORY_ALIASES = {
  singing: "singing",
  dancing: "dancing",
  "stand-up-comedy": "stand_up_comedy",
  stand_up_comedy: "stand_up_comedy",
};

const optionalInt = (min, max) =>
  z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? null : value),
    z.coerce.number().int().min(min).max(max).nullable()
  );

const optionalText = (max) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value : null),
    z.string().trim().max(max).nullable()
  );

const participantSchema = z.object({
  fullName: z.string({ error: "Full name is required." }).trim().min(2, "Full name is required.").max(80),
  email: z
    .string({ error: "A valid email is required." })
    .trim()
    .toLowerCase()
    .email("A valid email is required.")
    .max(254),
  phone: z
    .string({ error: "A valid 10-digit mobile number is required." })
    .trim()
    .transform((value) => value.replace(/[\s-]/g, "").replace(/^(\+91|0)/, ""))
    .refine(
      (value) => /^[6-9]\d{9}$/.test(value),
      "A valid 10-digit mobile number is required."
    ),
  age: optionalInt(Number(process.env.MIN_PARTICIPANT_AGE) || 1, 100),
  gender: optionalText(30),
  city: optionalText(80),
  talentCategory: z
    .string({ error: "Talent category is required." })
    .transform((value) => CATEGORY_ALIASES[value])
    .refine(Boolean, "Invalid talent category."),
  performanceTitle: optionalText(150),
  performanceDuration: optionalInt(1, 600),
  videoLink: optionalText(500),
  consent: z.union([z.literal(true), z.literal("true")], {
    error: "Consent is required.",
  }),
});

function removeUploadedFile(file) {
  if (!file) return;

  try {
    fs.unlinkSync(file.path);
  } catch (cleanupError) {
    console.error("Video cleanup failed:", cleanupError.message);
  }
}

/**
 * Renames an uploaded video to "<name><last 4 digits of phone>.<ext>",
 * e.g. "Shibnath Das" + 8967947523 -> "shibnathdas7523.mp4".
 * A number is added if that name is already taken ("shibnathdas7523-2.mp4").
 */
export function videoFileName(currentFilename, directory, fullName, phone) {
  const base =
    fullName
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()
      .slice(0, 40) || "participant";
  const stem = `${base}${String(phone).slice(-4)}`;
  const extension = path.extname(currentFilename).toLowerCase() || ".mp4";

  let filename = `${stem}${extension}`;
  for (let n = 2; fs.existsSync(path.join(directory, filename)); n += 1) {
    filename = `${stem}-${n}${extension}`;
  }
  return filename;
}

export function renameUploadedVideo(file, fullName, phone) {
  const directory = path.dirname(file.path);
  const filename = videoFileName(file.filename, directory, fullName, phone);
  const target = path.join(directory, filename);
  fs.renameSync(file.path, target);

  // Keep multer's record in sync so cleanup on failure deletes the right file.
  file.filename = filename;
  file.path = target;
}

function registrationClosed() {
  const closesAt = process.env.PARTICIPANT_REGISTRATION_CLOSES_AT;
  if (!closesAt) return false;

  const deadline = new Date(closesAt);
  return !Number.isNaN(deadline.getTime()) && Date.now() > deadline.getTime();
}

export async function registerParticipant(req, res) {
  try {
    if (registrationClosed()) {
      removeUploadedFile(req.file);
      return res.status(403).json({
        success: false,
        message: "Participant registrations are closed.",
      });
    }

    const parsed = participantSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message || "Invalid registration details.",
      });
    }

    const data = parsed.data;

    // Either an uploaded video or a public link (YouTube, Drive, etc.) is required.
    let video;

    if (req.file) {
      renameUploadedVideo(req.file, data.fullName, data.phone);

      video = {
        videoOriginalName: req.file.originalname?.slice(0, 255) || null,
        videoUrl: `/uploads/videos/${req.file.filename}`,
        videoMimeType: videoMimeType(req.file),
        videoSize: req.file.size,
      };
    } else if (data.videoLink && /^https?:\/\/\S+\.\S+/i.test(data.videoLink)) {
      video = {
        videoOriginalName: null,
        videoUrl: data.videoLink,
        videoMimeType: null,
        videoSize: null,
      };
    } else {
      return res.status(400).json({
        success: false,
        message: "Performance video is required.",
      });
    }

    const participant = await prisma.participant.create({
      data: {
        registrationNumber: generateRegistrationNumber(),

        fullName: data.fullName,
        email: data.email,
        phone: data.phone,

        age: data.age,
        gender: data.gender,
        city: data.city,

        talentCategory: data.talentCategory,
        performanceTitle: data.performanceTitle,
        performanceDuration: data.performanceDuration,

        ...video,

        consent: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Participant registration completed successfully.",
      data: {
        registrationNumber: participant.registrationNumber,
        fullName: participant.fullName,
        talentCategory: participant.talentCategory,
        status: participant.status,
        createdAt: participant.createdAt,
      },
    });
  } catch (error) {
    console.error("Participant registration error:", error);

    // Delete uploaded video if DB insert fails
    removeUploadedFile(req.file);

    return res.status(500).json({
      success: false,
      message: "Unable to complete participant registration.",
    });
  }
}

export const getAllParticipants = async (req, res) => {
  try {
    const participants = await prisma.participant.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: participants.length,
      data: participants,
    });
  } catch (error) {
    console.error("Get all participants error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch participants",
    });
  }
};
