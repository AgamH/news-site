const express = require('express');
const controller = require('../controllers/adminLogController');
const { authenticateJwt, requireRole } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticateJwt, requireRole('editor'));
router.get('/logs', asyncHandler(controller.listLogs));
router.get('/logs/:id', asyncHandler(controller.getLog));

module.exports = router;