// src/routes/deckRoutes.js
const express = require('express');
const router = express.Router();
const deckController = require('../controllers/deckController');
const manaBaseController = require('../controllers/manaBaseController');
const scoutController = require('../controllers/scoutController');
const requireAuth = require('../middleware/requireAuth');

router.get('/me', requireAuth, deckController.getMyDecks); // Must come before /:id so "me" isn't captured as an id param
router.post('/me/sync', requireAuth, scoutController.syncMyDecks); // Same reason -- before /:id
router.get('/:id', deckController.getDeckById); // Assuming you have a method to get a deck by ID
router.post('/:id/probe', requireAuth, scoutController.probeDeck);
router.get('/:id/mana-base', manaBaseController.getManaBaseReport);
router.put('/:id/cards/:oracleId/category', deckController.setCardOverride);
router.delete('/:id/cards/:oracleId/category', deckController.clearCardOverride);
router.post('/:id/core-synergies', deckController.addCoreSynergy);
router.delete('/:id/core-synergies/:category', deckController.removeCoreSynergy);
router.get('/user/:username', deckController.getDecksByUser);
module.exports = router;