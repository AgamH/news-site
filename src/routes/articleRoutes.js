const express = require('express');
const controller = require('../controllers/articleController');
const { ensureDeviceId } = require('../middleware/deviceMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(controller.listPublishedArticles));
router.get('/:id', asyncHandler(controller.getPublishedArticle));
router.post('/:id/comments', ensureDeviceId, asyncHandler(controller.postComment));

module.exports = router;