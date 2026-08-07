const mineflayer = require('mineflayer');
const mineflayer_pvp = require('mineflayer-pvp')
require('dotenv').config();

function date() {
    return new Date().toLocaleString()
}
function createBot() {
const bot = mineflayer.createBot({
    host: process.env.SERVER,  // ADD SERVER= in .env
    port: parseInt(process.env.SERVER_PORT), // ADD SERVER_PORT in .env
    username: 'LMIC-MC-BOT',
    auth: 'offline' // Offline servers
});

bot.once('spawn', () => {
    console.log(`[${date()}] ${bot.username} active`)
});

bot.on('end', (reason) => {
    console.log(`[${date()}] ${bot.username} disconnected (${reason}). Reconnecting...` )
    setTimeout(createBot, 3000)
});

bot.on('kicked', (reason) => {
    console.log(`[${date()}] ${bot.username} kicked (${reason})`)
});

bot.on('error', (err) => {
    console.log(`[${date()}] Error: ${err.message}`)
});

bot.on('chat', (username, message) => {
    if (username === bot.username) return
    bot.chat(message)
});
}

process.on('uncaughtException', (err) => {
    console.log(`${date()} Critical error: ${err.message}`)
    console.log('Reconnecting...')
    setTimeout(createBot, 5000)
});

createBot();