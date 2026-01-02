// api/game.js
const express = require('express');
const app = express();

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'game-api',
    timestamp: new Date().toISOString(),
    endpoints: ['/api/health', '/api/save', '/api/load/:userId']
  });
});

// Простое сохранение (заглушка)
app.post('/api/save', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Save endpoint working',
    timestamp: new Date().toISOString()
  });
});

// Простая загрузка (заглушка)
app.get('/api/load/:userId', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Load endpoint working',
    userId: req.params.userId,
    timestamp: new Date().toISOString()
  });
});

// Экспорт для Vercel
module.exports = app;
