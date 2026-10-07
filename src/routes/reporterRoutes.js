const express = require('express');
const controller = require('../controllers/reporterController');
const { authenticatePage, requirePageRole } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticatePage, requirePageRole('reporter'));
router.get('/', asyncHandler(controller.showDashboard));
router.get('/new', controller.showNewForm);
router.get('/:id/edit', asyncHandler(controller.showEditForm));

module.exports = router;