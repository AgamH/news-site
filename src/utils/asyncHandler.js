/* Wraps an async (req, res, next) handler so a thrown error or rejected
  promise is forwarded to next instead of becoming an unhandled rejection */
function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };