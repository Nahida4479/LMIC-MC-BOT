const mineflayer = require('mineflayer');
const mineflayer_pvp = require('mineflayer-pvp');
require('dotenv').config();

function date() {
    return new Date().toLocaleString()
}

// Test AI Model
const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash']
const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

async function testGemini(model) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: 'text'}] }] })
        })
        console.log(response.ok ?`${model}: ACTIVE` : `${model}: ERROR`)
    } catch {
        console.log(`${model}: ERROR`)
    }
}

async function testGroq(model) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type':'application/json',
                'Authrization': `Bearer ${process.env.GROG_FREE_API}`
            },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: 'test' }] })
        })
        console.log(response.ok ? `${model}: ACTIVE` : `${model}: ERROR`)
    } catch {
        console.log(`${model}: ERROR`)
    }
}


async function testAllModels() {
for (const test of geminiModels) {
    await testGemini(test)
}

for (const test of groqModels) {
    await testGroq(test)
}
}
testAllModels();


function createBot() {
const bot = mineflayer.createBot({
    host: process.env.SERVER,  // ADD SERVER= in .env
    port: parseInt(process.env.SERVER_PORT), // ADD SERVER_PORT in .env
    username: process.env.BOT_NAME,
    auth: 'offline' // Offline servers
});

bot.once('spawn', () => {
    console.log(`[${date()}] ${bot.username} active`);
});

bot.on('end', (reason) => {
    console.log(`[${date()}] ${bot.username} disconnected (${reason}). Reconnecting...` )
    setTimeout(createBot, 2000)
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
    setTimeout(createBot, 2000)
});

createBot();