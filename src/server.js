import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import participantRoutes from "./routes/participantRoutes.js";
import attendeeRoutes from "./routes/attendeeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { adminErrorHandler } from "./middleware/adminErrorHandler.js";
import { prisma } from "./config/prisma.js";
import { UPLOAD_ROOT } from "./middleware/upload.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be set in production.");
}

// Comma-separated list of allowed frontend origins, e.g.
// CORS_ORIGINS=https://strokeday.example.com,https://admin.strokeday.example.com
const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
)
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

// Behind Nginx, so req.ip is the real client address (needed for rate limits).
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));
app.disable("x-powered-by");

app.use(
    helmet({
        // Uploaded videos are played from the landing/CMS domains.
        crossOriginResourcePolicy: { policy: "cross-origin" },
    })
);

// CORS
app.use(
    cors({
        origin(origin, callback) {
            // Requests without an Origin header (curl, health checks) are allowed.
            callback(null, !origin || allowedOrigins.includes(origin));
        },
        credentials: true,
    })
);

// Body parsers
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// Rate limits
const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.REGISTRATION_RATE_LIMIT) || 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again in a few minutes.",
    },
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
        success: false,
        message: "Too many login attempts. Please try again in 15 minutes.",
    },
});

// Static uploads
app.use(
    "/uploads",
    express.static(UPLOAD_ROOT, {
        maxAge: "7d",
        index: false,
        dotfiles: "deny",
    })
);

// Routes
app.use("/participants/participateRegister", registrationLimiter);
app.use("/attendees/register", registrationLimiter);
app.use("/admin/login", loginLimiter);

app.use("/participants", participantRoutes);
app.use("/attendees", attendeeRoutes);
app.use("/admin", adminRoutes);

// Health check
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Stroke Day API is running",
    });
});

app.get("/health", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ success: true, database: "up" });
    } catch {
        res.status(503).json({ success: false, database: "down" });
    }
});

// 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

app.use(adminErrorHandler);

const server = app.listen(PORT, () => {
    console.log(
        `Server running on port ${PORT} (${isProduction ? "production" : "development"})`
    );
    console.log(`Uploads directory: ${UPLOAD_ROOT}`);
    console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});

// Large video uploads on slow mobile connections need a long request timeout.
server.requestTimeout = 15 * 60 * 1000;

function shutdown(signal) {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
        await prisma.$disconnect().catch(() => {});
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
