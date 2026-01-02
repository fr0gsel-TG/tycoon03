// api/bot.js
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());

// Используем переменную окружения или токен напрямую для теста
const token = process.env.TELEGRAM_BOT_TOKEN || '7990636161:AAFF4FSSnOfzipZ03KOaJEQ11NRi0dke3HA';
const bot = new TelegramBot(token);

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const gameUrl = `https://tycoon03.vercel.app/?tg=${chatId}`;
  
  bot.sendMessage(chatId, `🎮 *Добро пожаловать в StoreTycoon!*\n\nНажмите кнопку ниже, чтобы начать игру:`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '🎮 Начать игру', url: gameUrl }
      ]]
    }
  });
});

// Любое сообщение
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Если не /start, отправляем подсказку
  if (!text.startsWith('/')) {
    bot.sendMessage(chatId, 'Используйте /start чтобы начать игру!');
  }
});

// Webhook endpoint
app.post('/bot/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check endpoint (ОБЯЗАТЕЛЬНО!)
app.get('/bot/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'telegram-bot',
    timestamp: new Date().toISOString()
  });
});

// Экспорт для Vercel
module.exports = app;
