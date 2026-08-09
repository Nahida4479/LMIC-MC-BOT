const mineflayer = require('mineflayer');
const mineflayer_pvp = require('mineflayer-pvp');
require('dotenv').config();

function date() {
    return new Date().toLocaleString()
}

const avaliableAiProviders = []
const conversationHistory = {}
const maxHistoryLenght = 20;

function addToHistory(username, role, content) {
    if (!conversationHistory[username]) {
        conversationHistory[username] = []
    }
    conversationHistory[username].push({ role, content })
    
    if (conversationHistory[username].length > maxHistoryLenght) {
        conversationHistory[username].shift()
    }
}

if (process.env.HACKCLUB_FREE_API) {
    avaliableAiProviders.push('hackclub')
}

if (process.env.GEMINI_FREE_API) {
    avaliableAiProviders.push('gemini')
}

if (process.env.GROQ_FREE_API) {
    avaliableAiProviders.push('groq')
}

console.log(`Providers: ${avaliableAiProviders.join(',') || 'NONE'}`)

async function askAI(prompt, username) {
    addToHistory(username, 'user', prompt);

    if (avaliableAiProviders.includes('hackclub')) {
        const result = await askHackClub(conversationHistory[username])
        if (result) {
            addToHistory(username, 'assistant', result)
            return result
        }
    }

    if (avaliableAiProviders.includes('groq')) {
        const result = await askGroq(conversationHistory[username])
        if (result) {
            addToHistory(username, 'assistant', result)
            return result
        }
    }

    if (avaliableAiProviders.includes('gemini')) {
        const result = await askGemini(conversationHistory[username])
        if (result) {
            addToHistory(username, 'assistant', result)
            return result
        }
    }

    console.log("You don't insert token into .env")
    return null
}

// Test AI Model
const geminiModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"   ]
const HackClubModels = ['meta-llama/llama-3.3-70b-instruct']

async function testHackClub(model) {
    try {
        const response = await fetch("https://ai.hackclub.com/proxy/v1/chat/completions", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.HACKCLUB_FREE_API}`
            },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: 'test' }] })
        })

        if (response.ok) {
            console.log(`${model}: ACTIVE`)
        } else {
            const errorText = await response.text()
            console.log(`${model}: ERROR (${response.status}) - (${errorText})`)
        }
    } catch (err) {
        console.log(`${model}: ERROR ${err.message}`)
    }
}

async function testGemini(model) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_FREE_API}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: 'text'}] }] })
        })
        if (response.ok) {
        console.log(response.ok ?`${model}: ACTIVE` : `${model}: ERROR`)
        } else {
            const errorText = await response.text();
            console.log(`${model}: ERROR (status ${response.status}) - ${errorText}`)
        }
    } catch (err) {
        console.log(`${model}: ERROR ${err.message}`)
    }
}

async function testGroq(model) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type':'application/json',
                'Authorization': `Bearer ${process.env.GROQ_FREE_API}`
            },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: 'test' }] })
        })
        if (response.ok) {
        console.log(response.ok ? `${model}: ACTIVE` : `${model}: ERROR`)
        } else {
            const errorText = await response.text();
            console.log(`${model}: ERROR (status ${response.status}) - ${errorText}`)
        }
    } catch (err) {
        console.log(`${model}: ERROR ${err.message}`)
    }
}


async function testAllModels() {
for (const test of geminiModels) {
    await testGemini(test)
}

for (const test of groqModels) {
    await testGroq(test)
}

for (const test of HackClubModels) {
    await testHackClub(test)
}
}
testAllModels();


async function askHackClub(messages) {
    if (avaliableAiProviders.includes('hackclub')) {
        for (const model of HackClubModels) {
            try {
        
        const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.HACKCLUB_FREE_API}`
            },
            body: JSON.stringify({ model, messages })
        });

        if (response.ok) {
            const data = await response.json();
            return data.choices[0].message.content
        }
    } catch (err) {
        console.log(`${date()} HackClub model ${model} failed: ${err.message}`)
    }
}
return null
} 
}

async function askGroq(messages) {
    if (avaliableAiProviders.includes('groq')) {
        for (const model of groqModels) {
            try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type':'application/json',
                    'Authorization': `Bearer ${process.env.GROQ_FREE_API}`
                },
                body: JSON.stringify({ model, messages })
            });

                if (response.ok) {
                    const data = await response.json()
                    return data.choices[0].message.content
                }
            } catch (err) {
                console.log(`${date()} Groq model ${model} failed: ${err.message}`)
            }
        }
        return null
    }
}


function convertForGemini(messages) {
    return messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }))
}

async function askGemini(messages) {
    if (avaliableAiProviders.includes('gemini')) {
        for (const model of geminiModels) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_FREE_API}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json'},
                    body: JSON.stringify({ contents: convertForGemini(messages) })
                });
                if (response.ok) {
                    const data = await response.json();
                    return data.candidates[0].content.parts[0].text
                }
            } catch (err) {
                console.log(`${date()} Gemini model ${model} failed ${err.message}`)
            }
        }
        return null
    }
}



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

bot.on('chat', async (username, message) => {
    if (username === bot.username) return

    if (message.toLowerCase().includes(bot.username.toLowerCase())) {
        const response = await askAI(message, username)
        if (response) {
            bot.chat(response)
        }
    }
});
}

process.on('uncaughtException', (err) => {
    console.log(`${date()} Critical error: ${err.message}`)
    console.log('Reconnecting...')
    setTimeout(createBot, 2000)
});

createBot();