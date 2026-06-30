// src/routes/deckRoutes.js
const express = require('express');
const router = express.Router();
const deckController = require('../controllers/deckController');

router.get('/', deckController.getAllDecks);
router.get('/:id', deckController.getDeckById); // Assuming you have a method to get a deck by ID
router.get('/user/:username', deckController.getDecksByUser);
module.exports = router;