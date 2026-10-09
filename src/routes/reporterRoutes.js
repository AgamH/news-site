const express = require('express');
const controller = require('../controllers/reporterController');
const { authenticatePage, requirePageRole } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticatePage, requirePageRole('reporter'));
router.get('/', asyncHandler(controller.showDashboard));
router.get('/new', controller.showNewForm);
router.post('/new', asyncHandler(controller.createArticle));
router.get('/:id/edit', asyncHandler(controller.showEditForm));
router.post('/:id/edit', asyncHandler(controller.updateArticle));

module.exports = router;