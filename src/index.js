// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*', // Allow all origins for now; adjust as needed for security,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Placeholder for your routes
// app.use('/api/decks', require('./routes/deckRoutes'));

app.listen(PORT, () => {
  console.log(`Archrider API running on port ${PORT}`);
});