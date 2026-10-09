const express = require('express');
const controller = require('../controllers/reporterController');
const { authenticateJwt, requireRole } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticateJwt, requireRole('reporter'));
router.post('/articles', asyncHandler(controller.autosaveCreate));
router.put('/articles/:id', asyncHandler(controller.autosaveUpdate));

module.exports = router;
