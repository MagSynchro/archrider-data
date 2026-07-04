// authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const requireAuth = require('../middleware/requireAuth');
const requireSession = require('../middleware/requireSession');

router.post('/register', authController.register);
router.post('/verify', authController.verify);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);
router.get('/profile', requireSession, authController.getProfile);
router.put('/profile', requireAuth, authController.updateProfile);

module.exports = router;
