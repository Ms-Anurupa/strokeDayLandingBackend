import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import participantRoutes from "./routes/participantRoutes.js";
import { prisma } from "./config/prisma.js";

const app = express();

const PORT = process.env.PORT || 5000;

const FRONTEND_URL =
    process.env.FRONTEND_URL || "http://localhost:5173";

//cors configuration
app.use(
    cors({
        origin: FRONTEND_URL,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    "/uploads",
    express.static(path.resolve("uploads"))
);

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Stroke Day Landing Backend is running!",
    });
});

app.get("/api/health", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.json({
            success: true,
            message: "API and database are healthy.",
            database: "connected",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Database health check failed:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed.",
            database: "disconnected",
        });
    }
});

// routes

app.use(
    "/api/participants",
    participantRoutes
);

// error handler

app.use((error, req, res, next) => {
    console.error("API error:", error);

    if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            success: false,
            message: "Video must be 100 MB or smaller.",
        });
    }

    if (
        error.message === "Only video files are allowed."
    ) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }

    res.status(500).json({
        success: false,
        message: "Something went wrong on the server.",
    });
});


const server = app.listen(PORT, () => {
    console.log("");
    console.log("==========================================");
    console.log("STROKE DAY BACKEND");
    console.log("==========================================");
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Frontend: ${FRONTEND_URL}`);
    console.log(
        `API: http://localhost:${PORT}/api/participants`
    );
    console.log("==========================================");
    console.log("");
});


// Graceful shutdown
async function shutdown() {
    console.log("Shutting down...");

    await prisma.$disconnect();

    server.close(() => {
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);