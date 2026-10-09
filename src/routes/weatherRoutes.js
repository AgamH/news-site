const express = require('express');
const controller = require('../controllers/weatherController');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(controller.getWeather));

module.exports = router;