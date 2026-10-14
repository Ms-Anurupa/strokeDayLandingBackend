import { z } from "zod";
import { prisma } from "../config/prisma.js";

const attendeeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, "").replace(/^(\+91|0)/, ""))
    .refine((value) => /^[6-9]\d{9}$/.test(value), "Invalid phone"),
  consent: z.literal(true),
});

export const registerAttendee = async (req, res) => {
  try {
    const parsed = attendeeSchema.safeParse(req.body ?? {});

    if (!parsed.success) {
      const consentMissing = parsed.error.issues.some(
        (issue) => issue.path[0] === "consent"
      );

      return res.status(400).json({
        success: false,
        message: consentMissing
          ? "You must accept the invitation terms to continue."
          : "Please provide a valid name, email and 10-digit mobile number.",
      });
    }

    const { name, email, phone } = parsed.data;

    // Check for duplicate email or phone
    const existingAttendee = await prisma.attendee.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
      select: { id: true },
    });

    if (existingAttendee) {
      return res.status(409).json({
        success: false,
        message:
          "An attendee with this email or phone number is already registered.",
      });
    }

    const registrationNumber =
      `ATT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const attendee = await prisma.attendee.create({
      data: {
        name,
        email,
        phone,
        registrationNumber,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Attendee registered successfully.",
      data: {
        registrationNumber: attendee.registrationNumber,
        name: attendee.name,
        createdAt: attendee.createdAt,
      },
    });
  } catch (error) {
    console.error("Attendee registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register attendee.",
    });
  }
};

export const getAllAttendees = async (req, res) => {
  try {
    const attendees = await prisma.attendee.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: attendees.length,
      data: attendees,
    });
  } catch (error) {
    console.error("Get all attendees error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendees",
    });
  }
};
