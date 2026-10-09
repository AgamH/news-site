const express = require('express');
const controller = require('../controllers/editorController');
const { authenticatePage, requirePageRole } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticatePage, requirePageRole('editor'));
router.get('/', asyncHandler(controller.showDashboard));
router.get('/:id', asyncHandler(controller.showReview));
router.post('/:id/review', asyncHandler(controller.reviewArticle));
router.get('/:id/edit', asyncHandler(controller.showEditForm));
router.post('/:id/edit', asyncHandler(controller.updateArticle));
router.get('/:id/analytics', asyncHandler(controller.showAnalytics));
router.post('/:id/delete', asyncHandler(controller.deleteArticle));

module.exports = router;