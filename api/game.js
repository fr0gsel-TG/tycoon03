const express = require('express');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Инициализация базы данных
const dbFile = path.join(__dirname, '../data/db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { users: [], games: [], saves: [] });

// Создаем папку data если ее нет
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, '../data'))) {
  fs.mkdirSync(path.join(__dirname, '../data'));
}

// Middleware для логирования
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Сохранение игры
app.post('/api/save', async (req, res) => {
  try {
    const { userId, gameData, stats } = req.body;
    
    if (!userId || !gameData) {
      return res.status(400).json({ error: 'Missing userId or gameData' });
    }
    
    await db.read();
    
    // Обновляем пользователя
    let user = db.data.users.find(u => u.chatId == userId);
    if (!user) {
      user = {
        id: userId,
        chatId: userId,
        lastActive: new Date().toISOString(),
        gameState: gameData
      };
      db.data.users.push(user);
    } else {
      user.gameState = gameData;
      user.lastActive = new Date().toISOString();
    }
    
    // Сохраняем историю игры
    const gameSave = {
      id: Date.now().toString(),
      userId: userId,
      saveData: gameData,
      stats: stats || {},
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    db.data.saves.push(gameSave);
    
    // Обновляем общую статистику
    let userGame = db.data.games.find(g => g.userId == userId);
    if (!userGame) {
      userGame = {
        userId: userId,
        totalEarned: stats?.totalEarned || 0,
        reputation: stats?.reputation || 0,
        playTime: stats?.playTime || 0,
        lastPlayed: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      db.data.games.push(userGame);
    } else {
      userGame.totalEarned = stats?.totalEarned || userGame.totalEarned;
      userGame.reputation = stats?.reputation || userGame.reputation;
      userGame.playTime = stats?.playTime || userGame.playTime;
      userGame.lastPlayed = new Date().toISOString();
    }
    
    await db.write();
    
    res.json({ 
      success: true, 
      message: 'Game saved successfully',
      saveId: gameSave.id
    });
    
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save game' });
  }
});

// Загрузка игры
app.get('/api/load/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await db.read();
    
    const user = db.data.users.find(u => u.chatId == userId);
    
    if (!user || !user.gameState) {
      return res.status(404).json({ error: 'No saved game found' });
    }
    
    res.json({
      success: true,
      gameData: user.gameState,
      lastSaved: user.lastActive
    });
    
  } catch (error) {
    console.error('Load error:', error);
    res.status(500).json({ error: 'Failed to load game' });
  }
});

// Получение статистики
app.get('/api/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await db.read();
    
    const userGame = db.data.games.find(g => g.userId == userId);
    const userSaves = db.data.saves.filter(s => s.userId == userId);
    
    if (!userGame) {
      return res.json({
        totalEarned: 0,
        reputation: 0,
        playTime: 0,
        savesCount: 0,
        lastPlayed: null
      });
    }
    
    res.json({
      totalEarned: userGame.totalEarned || 0,
      reputation: userGame.reputation || 0,
      playTime: userGame.playTime || 0,
      savesCount: userSaves.length,
      lastPlayed: userGame.lastPlayed
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Глобальная статистика
app.get('/api/global-stats', async (req, res) => {
  try {
    await db.read();
    
    const totalPlayers = db.data.users.length;
    const totalGames = db.data.games.length;
    const totalEarned = db.data.games.reduce((sum, game) => sum + (game.totalEarned || 0), 0);
    const totalPlayTime = db.data.games.reduce((sum, game) => sum + (game.playTime || 0), 0);
    
    // Топ 5 игроков
    const topPlayers = db.data.games
      .map(game => {
        const user = db.data.users.find(u => u.chatId == game.userId);
        return {
          name: user?.firstName || 'Anonymous',
          earnings: game.totalEarned || 0,
          reputation: game.reputation || 0
        };
      })
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 5);
    
    res.json({
      totalPlayers,
      totalGames,
      totalEarned,
      totalPlayTimeHours: Math.floor(totalPlayTime / 60),
      topPlayers,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Global stats error:', error);
    res.status(500).json({ error: 'Failed to get global stats' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'storetycoon-game-api',
    timestamp: new Date().toISOString()
  });
});

// Экспорт для Vercel
module.exports = app;