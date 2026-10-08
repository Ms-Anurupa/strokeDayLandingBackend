import express from "express";
import cors from "cors";
import participantRoutes from "./routes/participantRoutes.js";
import attendeeRoutes from "./routes/attendeeRoutes.js";

const app = express();

const PORT = process.env.PORT || 5000;

// CORS
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        credentials: true,
    })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/participants", participantRoutes);
app.use("/attendees", attendeeRoutes);

// Health check
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Stroke Day API is running",
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});