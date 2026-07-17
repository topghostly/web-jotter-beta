export function errorHandler(err, req, res, next) {
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid id" });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: "Duplicate value" });
  }
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ error: err.message || "Internal server error" });
}
