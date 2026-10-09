const express = require('express');

const {
  showHomePage,
  showArticlePage,
  showLoginPage,
  showRegistrationPage,
  showLogDashboard,
} = require('../controllers/pageController');

const {
  authenticatePage,
  attachUserIfPresent,
  requirePageRole,
} = require('../middleware/authMiddleware');

const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/login', showLoginPage);

router.get('/register/:role', showRegistrationPage);

router.get(
  '/admin/logs',
  authenticatePage,
  requirePageRole('editor'),
  asyncHandler(showLogDashboard)
);

router.get(
  '/articles/:id',
  attachUserIfPresent,
  asyncHandler(showArticlePage)
);

router.get(
  '/',
  attachUserIfPresent,
  asyncHandler(showHomePage)
);

module.exports = router;