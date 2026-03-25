const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  const statusCode = err.statusCode || 500;
  const status = err.status || "error";

  const payload = {
    status,
    message: err.message || "Internal Server Error",
  };

  if (process.env.NODE_ENV !== "production")
    payload.origin = err.origin || err.name;

  res.status(statusCode).json(payload);
};

export default errorHandler;
