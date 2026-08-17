const mineflayer = require('mineflayer');
const mineflayer_pvp = require('mineflayer-pvp').plugin;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalNear } = require('mineflayer-pathfinder').goals;
const collectBlock = require('mineflayer-collectblock').plugin
const translations = require('./languages/languages');
const languages = require('./languages/languages');
const mcmobs = require('./mc_mobs');
const hostileMobs = mcmobs.hostileMobs
require('dotenv').config();

function date() {
    return new Date().toLocaleString()
}

const avaliableAiProviders = []
const conversationHistory = {}
const maxHistoryLenght = 20;
let reconnecting = false;
let defaultMove;
let botBusy = false;
let followingPlayer = null;
let lastUniversalPosition;
let stuckCounter = 0;

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
const groqModels = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"]
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

async function interpretCommand(message) {
    const prompt = `You are a Minecraft bot command interpreter. Analyze the pleyer,s message and respond ONLY with JSON in this exact format:
    {"action": "collect", "block": "<minecraft_block_name>", "amount": <number>, "language": "<pl_or_en>"}
    or
    {"action": "attack", "target": "<mob_name_or_player_username>", "amount": <number>, "language": "<pl_or_en>"}
    or
    {"action": "chat", "block": null, "amount": null, "language": "<pl_or_en>"}

    Use "pl" for language if the player wrote in Polish, otherwise use "en". 
    If the message asks the collect/gather/mine any resource, use "collect" with:
    - "block": the Minecraft official block name in English, lowercase, using underscores (e.g. "oak_log", "diamont_ore", "iron_ore", "cobblestone", grass_block, stone_block, deepslate)
    - "amount": the requested quantity (default 1 if not specified)
    
    If the message asks to attack, kill, or fight a mob or player, use "attack" with:
    - "target": the exact player username if attacking a player, OR the minecraft mob name in English lowercase with underscores if attacking a mob (e.g. "zombie", "skeleton", "spider", "creeper", "ghast", "enderman", "shulker", "ender_dragon", "pillager", "blaze", "breeze", "cow", "piglin", "sheep")

    If attacking mobs, "amount" is how many to kill (default 1 if not specified). If attacking a player, "amount" should always be 1.

    If message is anything else, use "action": "chat".
    Please answer in MAXIMUM 1-2 short sentences.

    Player message: "${message}"
    
    Respond ONLY with the JSON, NOTHING ELSE.`
    
    const response = await askAI(prompt, 'system_interpreter') 
    
    try {
        const cleaned = response.replace(/```json|```/g, '').trim()
        return JSON.parse(cleaned)
    } catch (err) {
        console.log(`Failed to parse AI response: ${response}`)
        return { action: 'chat', block: null, amount: null}
    }

}


function timeout(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error("Timeout"))
        }, ms)
    })
}

function createBot() {
reconnecting = false;
const bot = mineflayer.createBot({
    host: process.env.SERVER,  // ADD SERVER= in .env
    port: parseInt(process.env.SERVER_PORT), // ADD SERVER_PORT in .env
    username: process.env.BOT_NAME, 
    auth: 'offline' // Offline servers

});

bot.loadPlugin(pathfinder);
bot.loadPlugin(collectBlock);
bot.loadPlugin(mineflayer_pvp)

function startFollowingPlayer(username) {
    followingPlayer = username
}

function stopFollowing() {
    followingPlayer = null
}

function sendChat(text) {
    if (!text) {
        return;
    }

    const oneLine = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    if (oneLine.length > 200) {
        bot.chat(oneLine.substring(0, 197) + "...")
    } else {
        bot.chat(oneLine)
    }
}

let blockedTicks = 0;
let autoJumping = false;
let failedJumpt = 0;
let unsticking = false;
let unstickAttemps = 0;
let watchdogLastPosition = null;
let watchdogStuckStreak= 0;
let watchdogRecoveryAttempts = 0;

function isSolid(block) {
    if (!block) {
        return false
    }
    return block.boundingBox === 'block'
}

function hasHeadroom() {
    const blockOverBot = bot.blockAt(bot.entity.position.offset(0, 2, 0))
    return !isSolid(blockOverBot)
}

async function unstickSideways() {
    if (unsticking) { 
        return
    }
    unsticking = true;

    try {
    const direction = unstickAttemps % 2 === 0 ? "left" : "right"
    unstickAttemps++

    console.log(`Unstick: stepping ${direction}`)

    bot.setControlState(direction, true)
    bot.setControlState("jump", true)

    await new Promise((resolve) => {
        setTimeout(resolve, 300)
    });

    bot.setControlState(direction, false)
    bot.setControlState("jump", false)
} finally {
    unsticking = false
    }
}

function getBlockingBlocks() {
    const block = [];
    const cursorBlock = bot.blockAtCursor(3);
    if (cursorBlock) block.push(cursorBlock);

    const yaw = bot.entity.yaw;
    const dx = -Math.sin(yaw);
    const dz = -Math.cos(yaw);
    const frontPos = bot.entity.position.offset(dx, 0, dz)
    block.push(bot.blockAt(frontPos));
    block.push(bot.blockAt(frontPos.offset(0, 1, 0)));

    const seen = new Set();
    return block.filter((block) => {
        if (!block) {
            return false;
        }

        const key = `${block.position.x},${block.position.y},${block.position.y}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    })

}

bot.on("physicsTick", () => {
    if (!bot.entity) {
        return;
    }

    const recentlyDug = bot.lastDigTime &&  (performance.now() - bot.lastDigTime < 1500)

    if (bot.targetDigBlock || bot.pathfinder.isMining() || bot.pathfinder.isBuilding() || recentlyDug) {
        blockedTicks = 0;
        failedJumpt = 0;
        if (autoJumping) {
            bot.setControlState("jump", false)
            autoJumping = false;
        }
        return
    }

    const wantsToMove = bot.pathfinder.isMoving()

    if (!wantsToMove) {
        blockedTicks = 0;
        failedJumpt = 0;
        if (autoJumping) {
            bot.setControlState("jump", false)
            autoJumping = false;
        }
        return
    }

    if (unsticking) {
        return
    }

    const velocity = bot.entity.velocity
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)

    if (bot.entity.onGround && speed < 0.05) {
        blockedTicks++
    } else {
        blockedTicks = 0
        if (speed >= 0.05) {
        failedJumpt = 0
        }
    }

    if (blockedTicks >= 8) {
        blockedTicks = 0

        console.log(`Blocked: speed=${speed.toFixed(3)} isMoving=${bot.pathfinder.isMoving()} botBusy=${botBusy} headroom=${hasHeadroom()} failedJumps=${failedJumpt}`)

        if (failedJumpt < 2 && hasHeadroom()) {
            console.log("Auto jump");
            bot.setControlState("jump", true);
            autoJumping = true;
            failedJumpt++;
        } else {
            failedJumpt = 0;
            unstickSideways();
        }
        return
    }

    if (autoJumping && bot.entity.onGround) {
        bot.setControlState("jump", false);
        autoJumping = false;
    }
})

async function goToPlayer(target) {
    const p = target.position
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 1))

    await new Promise((resolve) => {
        setTimeout(resolve, 5000)
    })
}

function isBotTrapped() {
    const pos = bot.entity.position;
    const above = bot.blockAt(pos.offset(0, 1 , 0))
    const aboveAbove = bot.blockAt(pos.offset(0, 2, 0))

    if (above && above.name !== "air") {
        if (aboveAbove && aboveAbove.name !== "air") {
            return true
        }
    }
    return false
}
async function digOut() {
    while (isBotTrapped()) {
        const above = bot.blockAt(bot.entity.position.offset(0, 1, 0))
        if (above && above.name !== "air") {
            await bot.dig(above)
        }
    }
}


const followInternal = setInterval(async () => {
    
    if (!followingPlayer) {
        return
    }
    if (botBusy) {
        return
    }

    if (!bot.entity || !bot.players) {
        return
    }

    const nearbyHostile = bot.nearestEntity((entity) => {
        if (!hostileMobs.includes(entity.name)) {
            return false;
        }
        return bot.entity.position.distanceTo(entity.position) <= 8
    })

    if (nearbyHostile) {
        botBusy = true
        bot.pvp.movements = defaultMove;
        bot.pvp.followRange = 2;
        bot.pvp.attack(nearbyHostile)
        return
    }

    const player = bot.players[followingPlayer]
    if (!player || !player.entity) {
        return
    }

    const distanse = bot.entity.position.distanceTo(player.entity.position)

    if (distanse > 3) {
        const p = player.entity.position;
        bot.pathfinder.setMovements(defaultMove)
        bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 5))


        lastPosition = bot.entity.position.clone();
    }
}, 4000)

bot.once('spawn', () => {
    console.log(`[${date()}] ${bot.username} active`);
    defaultMove = new Movements(bot);
    console.log("collectBlock type:", typeof bot.collectBlock);
    defaultMove.canDig = true;
    defaultMove.allowParkour = true;
    defaultMove.scafoldingBlocks.push(bot.registry.itemsByName['dirt'].id);
    defaultMove.allowSprinting = false;
    bot.collectBlock.movements = defaultMove;
});

bot.on('end', (reason) => {
    clearInterval(followInternal)   
    console.log(`[${date()}] ${bot.username} disconnected (${reason}). Reconnecting...` )
    if (!reconnecting) {
        reconnecting = true;
        setTimeout(createBot, 2000)
    }
});

bot.on('kicked', (reason) => {
    console.log(`[${date()}] ${bot.username} kicked (${reason})`)
    if (!reconnecting) {
        reconnecting = true;
        setTimeout(createBot, 2000);
    }
});

bot.on('error', (err) => {
    console.log(`[${date()}] Error: ${err.message}`)
    if (!reconnecting) {
        reconnecting = true;
        setTimeout(createBot, 2000);
    }
});

bot.on('stoppedAttacking', () => {
    botBusy = false
})

bot.on('chat', async (username, message) => {
    if (username === bot.username) return
    if (!message.toLowerCase().includes(bot.username.toLowerCase())) return
    const target = bot.players[username] ? bot.players[username].entity : null;

    const nearbyBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0))
    console.log("Block under bot:", nearbyBlock ? nearbyBlock.name : "none")
    console.log("Bot inventory:", bot.inventory.items().map(item => item.name + " x" + item.count))


startFollowingPlayer(username)
let lastPosition = null;

    async function gatherBlocks(blockName, amount) {
        let collected = 0;
        let lastGatherPosition = null;
        const startY = Math.floor(bot.entity.position.y)

        while (collected < amount) {
            const targetBlock = findSafeBlocks(blockName, startY)

            console.log("Bot position:", bot.entity.position)
            console.log("Target block found:", targetBlock ? targetBlock.position : 'none')

            if (!targetBlock) {
                return collected
            }

            if (targetBlock.position.y < bot.entity.position.y -2) {
                return collected
            }


            console.log("Digging:", targetBlock.name, "| holding:", bot.heldItem ? bot.heldItem.name : "none")
            try {
            await Promise.race([
                bot.collectBlock.collect(targetBlock),
                timeout(60000)
            ]) 
            collected++
            console.log("Successfully collected! Total:", collected)
            console.log("Block now:", bot.blockAt(targetBlock.position).name)
            console.log("Bot inventory:", bot.inventory.items().map(item => item.name + " x" + item.count))

            } catch (err) {
                console.log(`Failed to collect: ${err.message}`)
                return collected
            }
        }
        return collected
    }


function findSafeBlocks(blockName, startY) {
    const positions = bot.findBlocks({
        matching: (block) => block.name === blockName,
        maxDistance: 32,
        count: 100
    })

    const botX = Math.floor(bot.entity.position.x)
    const botY = Math.floor(bot.entity.position.y)
    const botZ = Math.floor(bot.entity.position.z)

    for (const position of positions) {

        if (position.y < startY - 1) {
            continue
        }
        
        if (position.x === botX && position.z === botZ && position.y < botY) {
            console.log("Skipping block under bot:", position)
            continue
        }

        return bot.blockAt(position)
    }

    return null
}

    const interpretation = await interpretCommand(message)
    console.log("AI intepretation:", interpretation)

    if (interpretation.action === 'collect') {
        if (botBusy) {
            bot.chat(translations.getMessage(interpretation.language, "busy"))
            return
        }

        botBusy = true
        const noProblem = languages.getMessage(interpretation.language, "noProblem")

        bot.chat(`${noProblem} ${interpretation.amount}x ${interpretation.block}`)

        const collected = await gatherBlocks(interpretation.block, interpretation.amount) 

        if (isBotTrapped()) {
            console.log("Bot got stuck, wait");
            await digOut();
        }

        if (target) {
            await goToPlayer(target)
        }

        if (collected < interpretation.amount) {
            const text = translations.getMessage(interpretation.language, "foundOnly")
            bot.chat(`${text} ${collected}/${interpretation.amount} ${interpretation.block}`)
        } else {
            const text = translations.getMessage(interpretation.language, "collected")
            bot.chat(`${text} ${collected}x ${interpretation.block}`)
        }
        botBusy = false
        return
    }

    async function equipWeapon() {
        const weapon = bot.inventory.items().find((item) => {
            item.name.includes('sword')
        })

        if (weapon) {
            await bot.equip(weapon, 'hand')
        }
    }


    if (interpretCommand === 'attack') {
        if (botBusy) {
            bot.chat(translations.getMessage(interpretation.language, "busy"))
            return
        }

        botBusy = true;
        let killed = 0;
        const amount = interpretation.amount || 1;

        while (killed < amount) {
            let targetEntity = null
            const targetPlayer = bot.players[interpretation.target]

            if (targetPlayer && targetPlayer.entity) {
                targetEntity = targetPlayer.entity
            } else {
                targetEntity = bot.nearestEntity((entity) => entity.name === interpretation.target)
        }

            if (!targetEntity) {
                break
            }

            await equipWeapon();
            bot.pvp.movements = defaultMove
            bot.pvp.followRange = 2
            bot.pvp.attack(targetEntity)

            await new Promise((resolve) => {
                bot.once('stoppedAttacking', resolve)
            })
            killed = killed + 1
        }

        botBusy = false

        if (killed < amount) {
            const text = translations.getMessage(interpretation.language, "foundOnly")
            bot.chat(`${text} ${killed}x ${interpretation.target}`)
        }
        return
    }

    if (message.toLowerCase().includes('fight me')  ) {
        const player = bot.players[username];
        botBusy = true;

        if (!player) {
            const dontSeeYou = languages.getMessage(interpretation.language, "dontSeeYou")
            bot.chat(`${dontSeeYou}`)
            return
        }
        
        bot.pvp.movements = defaultMove;
        bot.pvp.followRange= 3;       
        bot.pvp.attack(player.entity);
        return;
    }

    if (message.toLowerCase().includes('stop')) {
        bot.pvp.stop();
        botBusy = false;
        return;
    }


    const chatPrompt = `You are a Minecraft bot named ${bot.username} talking on the in-game chat.
    Answer in MAXIMUM 2 short sentences and under 200 characters in total.
    Never use markdown, lists, numbering, headers or line breaks - this is a plain Minecraft chat.
    Answer in the same language the player used.

    Player message: "${message}"`

        const response = await askAI(chatPrompt, username)
        if (response) {
            sendChat(response)
    }
});
}

process.on('uncaughtException', (err) => {
    console.log(`${date()} Critical error: ${err.message}`)
    console.log('Reconnecting...')
    if (!reconnecting) {
        reconnecting = true;
        setTimeout(createBot, 2000);
    }});

createBot();