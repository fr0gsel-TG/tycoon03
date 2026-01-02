const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

const app = express();
app.use(express.json());

// Инициализация базы данных
const dbFile = path.join(__dirname, '../data/db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { users: [], games: [] });

// Инициализация бота
const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookUrl = process.env.VERCEL_URL ? `${process.env.VERCEL_URL}/bot/webhook` : process.env.WEBHOOK_URL;

const bot = new TelegramBot(token);

// Устанавливаем webhook
bot.setWebHook(webhookUrl);

// Команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;
  
  await db.read();
  
  let user = db.data.users.find(u => u.chatId === chatId);
  
  if (!user) {
    user = {
      id: chatId,
      chatId: chatId,
      username: username,
      firstName: msg.from.first_name,
      lastName: msg.from.last_name,
      gameState: null,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    db.data.users.push(user);
    await db.write();
  }
  
  const gameUrl = process.env.VERCEL_URL ? `${process.env.VERCEL_URL}/?tg=${chatId}` : `http://localhost:3000/?tg=${chatId}`;
  
  const welcomeMessage = `🎮 *Добро пожаловать в StoreTycoon: IT Empire!*

Здесь вы сможете построить свою IT-империю с нуля!

🚀 *Что вас ждет:*
• Наймите разработчиков и менеджеров
• Создайте офис мечты
• Выполняйте задания и зарабатывайте
• Боритесь с техдолгом и багами
• Развивайте свою компанию!

🎯 *Начните играть:* [Запустить игру](${gameUrl})

📊 *Команды бота:*
/profile - Ваш профиль
/leaderboard - Таблица лидеров
/help - Помощь

💰 *Связь с игрой:*
Ваш Telegram аккаунт привязан к игровому профилю. Все сохранения автоматически синхронизируются!`;
  
  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Играть', url: gameUrl }],
        [{ text: '📊 Профиль', callback_data: 'profile' }],
        [{ text: '🏆 Топ игроков', callback_data: 'leaderboard' }]
      ]
    }
  });
});

// Команда /profile
bot.onText(/\/profile/, async (msg) => {
  const chatId = msg.chat.id;
  
  await db.read();
  
  const user = db.data.users.find(u => u.chatId === chatId);
  const userGames = db.data.games.filter(g => g.userId === chatId);
  
  if (!user) {
    bot.sendMessage(chatId, 'Сначала запустите игру через /start');
    return;
  }
  
  const totalEarned = userGames.reduce((sum, game) => sum + (game.totalEarned || 0), 0);
  const totalPlayTime = userGames.reduce((sum, game) => sum + (game.playTime || 0), 0);
  
  const profileMessage = `👤 *Ваш профиль*

*Игрок:* ${user.firstName} ${user.lastName || ''}
*Telegram:* @${user.username || 'не указан'}

📈 *Статистика:*
• Игр сыграно: ${userGames.length}
• Всего заработано: $${totalEarned.toLocaleString()}
• Время в игре: ${Math.floor(totalPlayTime / 60)} минут

🎮 *Текущая игра:* ${user.gameState ? 'Активна' : 'Нет'}

💾 *Сохранения:* автоматически синхронизируются!

🔗 *Ссылка на игру:* ${process.env.VERCEL_URL ? `${process.env.VERCEL_URL}/?tg=${chatId}` : 'Не настроена'}`;
  
  bot.sendMessage(chatId, profileMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Продолжить игру', url: `${process.env.VERCEL_URL || 'http://localhost:3000'}/?tg=${chatId}` }],
        [{ text: '🔄 Новая игра', callback_data: 'new_game' }]
      ]
    }
  });
});

// Команда /leaderboard
bot.onText(/\/leaderboard/, async (msg) => {
  const chatId = msg.chat.id;
  
  await db.read();
  
  // Рассчитываем рейтинг для каждого пользователя
  const leaderboard = db.data.users.map(user => {
    const userGames = db.data.games.filter(g => g.userId === user.chatId);
    const totalEarned = userGames.reduce((sum, game) => sum + (game.totalEarned || 0), 0);
    const totalReputation = userGames.reduce((sum, game) => sum + (game.reputation || 0), 0);
    
    return {
      name: user.firstName,
      username: user.username,
      earnings: totalEarned,
      reputation: totalReputation,
      games: userGames.length,
      score: totalEarned + (totalReputation * 1000)
    };
  }).sort((a, b) => b.score - a.score).slice(0, 10);
  
  let leaderboardMessage = '🏆 *Топ 10 игроков*\n\n';
  
  leaderboard.forEach((player, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    leaderboardMessage += `${medal} *${player.name}* (@${player.username || 'N/A'})\n`;
    leaderboardMessage += `   💰 $${player.earnings.toLocaleString()} | ⭐ ${player.reputation} | 🎮 ${player.games} игр\n\n`;
  });
  
  const userRank = leaderboard.findIndex(p => p.username === msg.from.username);
  if (userRank !== -1) {
    leaderboardMessage += `\n📊 *Ваше место:* ${userRank + 1}`;
  }
  
  bot.sendMessage(chatId, leaderboardMessage, {
    parse_mode: 'Markdown'
  });
});

// Обработка callback-запросов
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = msg.chat.id;
  
  switch(data) {
    case 'profile':
      // Редирект на команду /profile
      bot.sendMessage(chatId, 'Загружаю профиль...');
      bot.onText(/\/profile/, msg);
      break;
      
    case 'leaderboard':
      // Редирект на команду /leaderboard
      bot.sendMessage(chatId, 'Загружаю таблицу лидеров...');
      bot.onText(/\/leaderboard/, msg);
      break;
      
    case 'new_game':
      await db.read();
      const userIndex = db.data.users.findIndex(u => u.chatId === chatId);
      if (userIndex !== -1) {
        db.data.users[userIndex].gameState = null;
        await db.write();
        
        const gameUrl = process.env.VERCEL_URL ? `${process.env.VERCEL_URL}/?tg=${chatId}&new=true` : `http://localhost:3000/?tg=${chatId}&new=true`;
        
        bot.sendMessage(chatId, '✅ Новая игра создана! Нажмите кнопку ниже, чтобы начать.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎮 Начать новую игру', url: gameUrl }]
            ]
          }
        });
      }
      break;
  }
  
  bot.answerCallbackQuery(callbackQuery.id);
});

// Webhook endpoint
app.post('/bot/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check
app.get('/bot/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Экспорт для Vercel
module.exports = app;