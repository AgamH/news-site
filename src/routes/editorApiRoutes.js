const express = require('express');
const controller = require('../controllers/editorController');
const { authenticateJwt, requireRole } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticateJwt, requireRole('editor'));
router.get('/articles/:id/analytics', asyncHandler(controller.getAnalytics));

module.exports = router;
