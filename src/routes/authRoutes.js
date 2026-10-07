const express = require('express');
const controller = require('../controllers/authController');
const { authenticateJwt } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.post('/register', asyncHandler(controller.register));
router.post('/login', asyncHandler(controller.login));
router.get('/me', authenticateJwt, controller.currentUser);
router.post('/logout', controller.logout);

module.exports = router;