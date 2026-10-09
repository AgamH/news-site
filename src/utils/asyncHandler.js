/**
 * Wraps an async (req, res, next) handler so a thrown error or rejected
 * promise is forwarded to next(err) instead of becoming an unhandled
 * rejection. Express 4 does not do this automatically, and relying on
 * Express 5's built-in forwarding would be fragile if the project is ever
 * run on an older Express, so every async handler is wrapped explicitly.
 */
function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };