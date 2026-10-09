const { httpError } = require('../utils/httpError');
const { logEvent } = require('../services/logService');

/** Placed after every router: anything that reaches here matched no route. */
function notFoundHandler(req, res, next) {
  next(httpError(404, 'Page not found.'));
}

const isApiRequest = (req) => req.originalUrl.startsWith('/api/');

/**
 * The single place that turns a thrown/forwarded error into a response.
 * - Known errors (httpError, with .expose) show their own message.
 * - Unknown errors always show a generic message to the client; the real
 *   message and stack only ever go to the log, never to the response body.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const safeMessage = err.expose
    ? err.message
    : statusCode < 500
      ? err.message || 'The request could not be completed.'
      : 'Something went wrong on our end. Please try again.';

  logEvent({
    level: statusCode >= 500 ? 'error' : 'warn',
    message: err.message || 'Unhandled error',
    source: 'error-handler',
    req,
    statusCode,
    stack: err.stack || '',
  }).catch(() => {});

  if (res.headersSent) return; // a response already started streaming; nothing more we can do

  if (isApiRequest(req)) {
    res.status(statusCode).json({ message: safeMessage });
    return;
  }

  res.status(statusCode).render(
    'error',
    { title: statusCode === 404 ? 'Page not found' : 'Something went wrong', message: safeMessage, statusCode },
    (renderErr, html) => {
      // If the error view itself fails to render, fall back to plain text rather than
      // letting the error handler crash the process.
      if (renderErr) {
        res.type('text/plain').send(`${statusCode} - ${safeMessage}`);
        return;
      }
      res.send(html);
    },
  );
}

module.exports = { notFoundHandler, errorHandler };
