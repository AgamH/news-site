/**
 * A plain Error with an HTTP status code attached, so a controller can
 * `throw httpError(404, 'Article not found.')` and the shared error
 * middleware (src/middleware/errorMiddleware.js) knows how to respond:
 * the statusCode and message are safe to send to the client as-is, unlike
 * an unexpected 500 whose message/stack must never reach the browser.
 */
function httpError(statusCode, message, extra) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true; // marks this message as safe to show the client
  if (extra) Object.assign(error, extra);
  return error;
}

module.exports = { httpError };
