import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../config/prisma.js";
import { createAdminToken } from "../utils/adminToken.js";

const REGISTRATION_MODELS = {
    participants: {
        model: "participant",
        searchableFields: [
            "fullName",
            "email",
            "phone",
            "registrationNumber",
            "city",
            "organization",
        ],
        editableFields: [
            "fullName",
            "email",
            "phone",
            "age",
            "gender",
            "city",
            "state",
            "organization",
            "performanceTitle",
            "performanceCategory",
            "experience",
            "status",
            "adminNotes",
        ],
        statuses: ["pending", "approved", "rejected"],
    },

    attendees: {
        model: "attendee",
        searchableFields: [
            "fullName",
            "email",
            "phone",
            "registrationNumber",
            "city",
            "organization",
        ],
        editableFields: [
            "fullName",
            "email",
            "phone",
            "age",
            "gender",
            "city",
            "state",
            "organization",
            "status",
            "adminNotes",
        ],
        statuses: ["pending", "invited", "confirmed", "declined"],
    },
};

function getModel(type) {
    const config = REGISTRATION_MODELS[type];

    if (!config) {
        const error = new Error("Invalid registration type");
        error.statusCode = 400;
        throw error;
    }

    const model = prisma[config.model];

    if (!model) {
        throw new Error(
            `Prisma model "${config.model}" was not found. Check your schema and model name.`
        );
    }

    return { config, model };
}

function parsePagination(query) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const requestedLimit = Number.parseInt(query.limit, 10) || 10;
    const limit = Math.min(100, Math.max(1, requestedLimit));

    return {
        page,
        limit,
        skip: (page - 1) * limit,
    };
}

function buildWhere(config, query) {
    const where = {};
    const search = String(query.search || "").trim();

    if (search) {
        where.OR = config.searchableFields.map((field) => ({
            [field]: {
                contains: search,
                mode: "insensitive",
            },
        }));
    }

    if (query.status) {
        if (!config.statuses.includes(query.status)) {
            const error = new Error("Invalid status filter");
            error.statusCode = 400;
            throw error;
        }

        where.status = query.status;
    }

    return where;
}

function getEditableData(config, body) {
    const data = {};

    for (const field of config.editableFields) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            data[field] = body[field];
        }
    }

    if (
        Object.prototype.hasOwnProperty.call(data, "status") &&
        !config.statuses.includes(data.status)
    ) {
        const error = new Error("Invalid status value");
        error.statusCode = 400;
        throw error;
    }

    if (
        Object.prototype.hasOwnProperty.call(data, "age") &&
        data.age !== null &&
        (!Number.isInteger(Number(data.age)) || Number(data.age) < 0)
    ) {
        const error = new Error("Age must be a non-negative integer");
        error.statusCode = 400;
        throw error;
    }

    if (Object.prototype.hasOwnProperty.call(data, "age") && data.age !== null) {
        data.age = Number(data.age);
    }

    return data;
}

export async function loginAdmin({ email, password }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const admin = await prisma.admin.findUnique({
        where: { email: normalizedEmail },
    });

    if (!admin || !admin.active) {
        return null;
    }

    const passwordMatches = await bcrypt.compare(
        String(password || ""),
        admin.passwordHash
    );

    if (!passwordMatches) {
        return null;
    }

    const token = createAdminToken(admin);

    return {
        token,
        admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
        },
    };
}

export async function getDashboardStats() {
    const [
        totalParticipants,
        totalAttendees,
        pendingParticipants,
        pendingAttendees,
        approvedParticipants,
        confirmedAttendees,
    ] = await Promise.all([
        prisma.participant.count(),
        prisma.attendee.count(),
        prisma.participant.count({ where: { status: "pending" } }),
        prisma.attendee.count({ where: { status: "pending" } }),
        prisma.participant.count({ where: { status: "approved" } }),
        prisma.attendee.count({ where: { status: "confirmed" } }),
    ]);

    return {
        totalParticipants,
        totalAttendees,
        totalRegistrations: totalParticipants + totalAttendees,
        pendingParticipants,
        pendingAttendees,
        approvedParticipants,
        confirmedAttendees,
    };
}

export async function listRegistrations(type, query) {
    const { config, model } = getModel(type);
    const { page, limit, skip } = parsePagination(query);
    const where = buildWhere(config, query);

    const [items, total] = await Promise.all([
        model.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
        }),
        model.count({ where }),
    ]);

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getRegistration(type, id) {
    const { model } = getModel(type);

    const item = await model.findUnique({
        where: { id },
    });

    if (!item) {
        const error = new Error("Registration not found");
        error.statusCode = 404;
        throw error;
    }

    return item;
}

export async function updateRegistration(type, id, body) {
    const { config, model } = getModel(type);
    const data = getEditableData(config, body);

    if (Object.keys(data).length === 0) {
        const error = new Error("No editable fields were supplied");
        error.statusCode = 400;
        throw error;
    }

    try {
        return await model.update({
            where: { id },
            data,
        });
    } catch (error) {
        if (error.code === "P2025") {
            const notFound = new Error("Registration not found");
            notFound.statusCode = 404;
            throw notFound;
        }

        throw error;
    }
}

async function removeParticipantVideo(participant) {
    if (!participant.videoPath) return;

    // Supports stored paths such as /uploads/videos/example.mp4.
    const filename = path.basename(participant.videoPath);
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads/videos");
    const videoPath = path.join(uploadDir, filename);

    try {
        await fs.unlink(videoPath);
    } catch (error) {
        // A missing file must not prevent the database record from being deleted.
        if (error.code !== "ENOENT") {
            console.error("Unable to delete participant video:", error.message);
        }
    }
}

export async function deleteRegistration(type, id) {
    const { model } = getModel(type);
    const existing = await getRegistration(type, id);

    if (type === "participants") {
        await removeParticipantVideo(existing);
    }

    await model.delete({ where: { id } });

    return { id };
}

export async function exportRegistrations(type, query = {}) {
    const { config, model } = getModel(type);
    const where = buildWhere(config, query);

    // Do not paginate exports; return all matching records.
    return model.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });
}