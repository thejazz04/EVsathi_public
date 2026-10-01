import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.originalUrl, method: req.method });

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.userMessage || err.message || 'An unexpected server error occurred',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};

export default errorHandler;
