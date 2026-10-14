export function adminErrorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    // statusCode is set by our services; status is set by body-parser (bad JSON, too large).
    const statusCode = error.statusCode || error.status || 500;

    if (statusCode >= 500) {
        console.error("API error:", error);
    }

    return res.status(statusCode).json({
        success: false,
        message:
            statusCode >= 500
                ? "Internal server error"
                : error.expose === false
                    ? "Request failed"
                    : error.message || "Request failed",
    });
}
