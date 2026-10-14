import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../config/prisma.js";
import { createAdminToken } from "../utils/adminToken.js";
import { VIDEO_DIRECTORY } from "../middleware/upload.js";

const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", 12);

// Field lists must match prisma/schema.prisma.
const REGISTRATION_MODELS = {
    participants: {
        model: "participant",
        idType: "string",
        searchableFields: [
            "fullName",
            "email",
            "phone",
            "registrationNumber",
            "city",
            "performanceTitle",
        ],
        editableFields: [
            "fullName",
            "email",
            "phone",
            "age",
            "gender",
            "city",
            "talentCategory",
            "performanceTitle",
            "status",
        ],
        statuses: ["PENDING", "APPROVED", "REJECTED"],
    },

    attendees: {
        model: "attendee",
        idType: "int",
        searchableFields: ["name", "email", "phone", "registrationNumber"],
        editableFields: ["name", "email", "phone"],
        statuses: [],
    },
};

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function getModel(type) {
    const config = REGISTRATION_MODELS[type];

    if (!config) {
        throw httpError(400, "Invalid registration type");
    }

    return { config, model: prisma[config.model] };
}

function parseId(config, id) {
    if (config.idType === "int") {
        const numericId = Number.parseInt(id, 10);

        if (!Number.isInteger(numericId) || String(numericId) !== String(id)) {
            throw httpError(404, "Registration not found");
        }

        return numericId;
    }

    return String(id);
}

function normalizeStatus(config, status) {
    const value = String(status || "").trim().toUpperCase();

    if (!config.statuses.includes(value)) {
        throw httpError(400, "Invalid status value");
    }

    return value;
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
    const search = String(query.search || "").trim().slice(0, 100);

    if (search) {
        where.OR = config.searchableFields.map((field) => ({
            [field]: {
                contains: search,
                mode: "insensitive",
            },
        }));
    }

    if (query.status && config.statuses.length) {
        where.status = normalizeStatus(config, query.status);
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

    for (const [field, value] of Object.entries(data)) {
        if (typeof value === "string") {
            data[field] = value.trim();
        }
    }

    if (Object.prototype.hasOwnProperty.call(data, "status")) {
        data.status = normalizeStatus(config, data.status);
    }

    if (Object.prototype.hasOwnProperty.call(data, "talentCategory")) {
        const category = String(data.talentCategory).toLowerCase().replace(/-/g, "_");
        if (!["singing", "dancing", "stand_up_comedy"].includes(category)) {
            throw httpError(400, "Invalid talent category");
        }
        data.talentCategory = category;
    }

    for (const field of ["fullName", "name"]) {
        if (Object.prototype.hasOwnProperty.call(data, field) && String(data[field]).length < 2) {
            throw httpError(400, "Name must be at least 2 characters");
        }
    }

    if (Object.prototype.hasOwnProperty.call(data, "phone") && !/^[6-9]\d{9}$/.test(String(data.phone))) {
        throw httpError(400, "Phone must be a valid 10-digit mobile number");
    }

    if (
        Object.prototype.hasOwnProperty.call(data, "email") &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))
    ) {
        throw httpError(400, "Enter a valid email address");
    }

    for (const field of ["gender", "city", "performanceTitle"]) {
        if (Object.prototype.hasOwnProperty.call(data, field) && data[field] === "") {
            data[field] = null;
        }
    }

    if (Object.prototype.hasOwnProperty.call(data, "email")) {
        data.email = String(data.email).toLowerCase();
    }

    if (Object.prototype.hasOwnProperty.call(data, "age")) {
        if (data.age === null || data.age === "") {
            data.age = null;
        } else if (
            !Number.isInteger(Number(data.age)) ||
            Number(data.age) < 0 ||
            Number(data.age) > 120
        ) {
            throw httpError(400, "Age must be a whole number between 0 and 120");
        } else {
            data.age = Number(data.age);
        }
    }

    return data;
}

export async function loginAdmin({ email, password }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const admin = await prisma.admin.findUnique({
        where: { email: normalizedEmail },
    });

    if (!admin || !admin.active) {
        // Keep timing similar whether or not the account exists.
        await bcrypt.compare(String(password || ""), DUMMY_PASSWORD_HASH);
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
        approvedParticipants,
        rejectedParticipants,
    ] = await Promise.all([
        prisma.participant.count(),
        prisma.attendee.count(),
        prisma.participant.count({ where: { status: "PENDING" } }),
        prisma.participant.count({ where: { status: "APPROVED" } }),
        prisma.participant.count({ where: { status: "REJECTED" } }),
    ]);

    return {
        totalParticipants,
        totalAttendees,
        totalRegistrations: totalParticipants + totalAttendees,
        pendingParticipants,
        approvedParticipants,
        rejectedParticipants,
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
    const { config, model } = getModel(type);

    const item = await model.findUnique({
        where: { id: parseId(config, id) },
    });

    if (!item) {
        throw httpError(404, "Registration not found");
    }

    return item;
}

export async function updateRegistration(type, id, body) {
    const { config, model } = getModel(type);
    const data = getEditableData(config, body);

    if (Object.keys(data).length === 0) {
        throw httpError(400, "No editable fields were supplied");
    }

    try {
        return await model.update({
            where: { id: parseId(config, id) },
            data,
        });
    } catch (error) {
        if (error.code === "P2025") {
            throw httpError(404, "Registration not found");
        }

        throw error;
    }
}

async function removeParticipantVideo(participant) {
    // Only locally stored uploads are deleted; external links are left alone.
    if (!participant.videoUrl?.startsWith("/uploads/videos/")) return;

    const filename = path.basename(participant.videoUrl);
    const videoPath = path.join(VIDEO_DIRECTORY, filename);

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
    const { config, model } = getModel(type);
    const existing = await getRegistration(type, id);

    await model.delete({ where: { id: parseId(config, id) } });

    if (type === "participants") {
        await removeParticipantVideo(existing);
    }

    return { id: existing.id };
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
