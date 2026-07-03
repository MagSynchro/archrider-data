// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    // '*' is invalid alongside credentials: true -- browsers reject
    // credentialed (cookie) requests against a wildcard origin. Falls back
    // to the Vite dev server origin locally; set CLIENT_ORIGIN in .env for
    // any deployment where frontend and backend aren't on the same origin.
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Basic health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));


app.use('/api/decks', require('./routes/deckRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));

app.listen(PORT, () => {
  console.log(`Archrider API running on port ${PORT}`);
});