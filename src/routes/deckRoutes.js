// src/routes/deckRoutes.js
const express = require('express');
const router = express.Router();
const deckController = require('../controllers/deckController');
const manaBaseController = require('../controllers/manaBaseController');
const requireAuth = require('../middleware/requireAuth');

router.get('/', deckController.getAllDecks);
router.get('/me', requireAuth, deckController.getMyDecks); // Must come before /:id so "me" isn't captured as an id param
router.get('/:id', deckController.getDeckById); // Assuming you have a method to get a deck by ID
router.get('/:id/mana-base', manaBaseController.getManaBaseReport);
router.put('/:id/cards/:oracleId/category', deckController.setCardOverride);
router.delete('/:id/cards/:oracleId/category', deckController.clearCardOverride);
router.get('/user/:username', deckController.getDecksByUser);
module.exports = router;