// src/routes/deckRoutes.js
const express = require('express');
const router = express.Router();
const deckController = require('../controllers/deckController');

router.get('/', deckController.getAllDecks);

module.exports = router;