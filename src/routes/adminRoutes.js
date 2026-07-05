// adminRoutes.js
const express = require('express');
const router = express.Router();
const staffAuthController = require('../controllers/staffAuthController');
const adminController = require('../controllers/adminController');
const requireStaffAuth = require('../middleware/requireStaffAuth');
const requireAdminRole = require('../middleware/requireAdminRole');
const requireOwnerRole = require('../middleware/requireOwnerRole');

// Staff auth -- no requireStaffAuth on login (that's the point).
router.post('/login', staffAuthController.login);
router.post('/logout', staffAuthController.logout);
router.get('/me', requireStaffAuth, staffAuthController.me);

// Every route below requires a valid staff session; requireAdminRole is
// layered on top for admin-only functions.
router.use(requireStaffAuth);

// Staff account management -- Admin or Owner can reach these; which
// *target* role each may act on (Admin can only touch Moderator
// accounts, only Owner can touch Admin accounts, nobody can touch Owner
// accounts) is enforced inside adminController.js. Resetting another
// staff member's password is Owner-only.
router.get('/staff', requireAdminRole, adminController.listStaffAccounts);
router.post('/staff', requireAdminRole, adminController.createStaffAccount);
router.delete('/staff/:id', requireAdminRole, adminController.deleteStaffAccount);
router.post('/staff/:id/reset-password', requireOwnerRole, adminController.resetStaffPassword);

// Audit log -- admin only.
router.get('/actions', requireAdminRole, adminController.listActions);

// User management -- viewing/banning/unbanning/password-reset shared by
// admin + moderator; add-credits and sync/probe-for-a-user are admin only.
router.get('/users', adminController.listUsers);
router.post('/users/:userId/ban', adminController.banUser);
router.post('/users/:userId/unban', adminController.unbanUser);
router.post('/users/:userId/reset-password', adminController.resetUserPassword);
router.post('/users/:userId/credits', requireAdminRole, adminController.addCredits);
router.post('/users/:userId/sync', requireAdminRole, adminController.syncUserDecks);

// Deck management -- viewing/deleting shared by admin + moderator;
// probing a specific deck for a user is admin only (paired with sync
// above).
router.get('/decks', adminController.listDecks);
router.delete('/decks/:deckId', adminController.deleteDeck);
router.post('/decks/:deckId/probe', requireAdminRole, adminController.probeDeckForUser);

module.exports = router;
