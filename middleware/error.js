function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not Found: ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  const status = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(status).json({
    message: err.message || "Server error",
    status
  });
}

module.exports = { notFound, errorHandler };
