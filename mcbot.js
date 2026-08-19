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
let reconnectDelay = 5000;

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

async function interpretCommand(message, contextSummary) {
    const prompt = `You are a Minecraft bot command interpreter. Analyze the pleyer,s message and respond ONLY with JSON in this exact format:
    {"action": "collect", "block": "<minecraft_block_name>", "amount": <number>, "language": "<pl_or_en>"}
    or
    {"action": "attack", "target": "<mob_name_or_player_username>", "amount": <number>, "language": "<pl_or_en>"}
    or
    {"action": "give", "item": "<minecraft_item_name>", "amount": <number>, "language": "<pl_or_en>"}
    or
    {"action": "chat", "block": null, "amount": null, "language": "<pl_or_en>"}

    Use "pl" for language if the player wrote in Polish, otherwise use "en". 
    If the message asks the collect/gather/mine any resource, use "collect" with:
    - "block": the Minecraft official block name in English, lowercase, using underscores (e.g. "oak_log", "diamont_ore", "iron_ore", "cobblestone", grass_block, stone_block, deepslate)
    - "amount": the requested quantity (default 1 if not specified)
    
    If the message asks to attack, kill, or fight a mob or player, use "attack" with:
    - "target": the exact player username if attacking a player, OR the minecraft mob name in English lowercase with underscores if attacking a mob (e.g. "zombie", "skeleton", "spider", "creeper", "ghast", "enderman", "shulker", "ender_dragon", "pillager", "blaze", "breeze", "cow", "piglin", "sheep")

    If attacking mobs, "amount" is how many to kill (default 1 if not specified). If attacking a player, "amount" should always be 1.
    If the message asks the bot to give, hand over, drop, or toss an item to the player (e.g. in any language "give me", "daj mi", "can I have"), use "give" with:
    - "item": copy the EXACT item name as it literally appears in the bot's inventory listed above. Do not guess a different material or variant. If the player asked generically (e.g. "sword" without specifying material) and the bot's inventory contains a matching item type, use that exact inventory name (e.g. inventory has "netherite_sword" -> use "netherite_sword", not "diamond_sword"). If nothing in the bot's inventory matches what was asked, set "item" to null.
    - "amount": the requested quantity (default 1 if not specified)

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
let watchdogCooldownUntil = 0;

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
    const saveGoal = bot.pathfinder ? bot.pathfinder.goal : null;
    if (saveGoal) {
        bot.pathfinder.setGoal(null);
    }

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

    await new Promise((resolve) => setTimeout(resolve, 100));
} finally {
    unsticking = false
    if (saveGoal) {
        bot.pathfinder.setGoal(saveGoal)
    }
    }
}

function getBlockingPlayerEntity() {
    return bot.nearestEntity((entity) => {
        if (entity.type !== 'player') return false;
        if (entity.username === bot.username) return false;
        return bot.entity.position.distanceTo(entity.position) < 1.2;
    })
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

        const key = `${block.position.x},${block.position.y},${block.position.z}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    })

}

async function forceUnstuck() { 

    const blockingPlayer = getBlockingPlayerEntity();
    if (blockingPlayer) {
        console.log(`Watchdog: the player ${blockingPlayer.username} blocks bot`)
        await unstickSideways();
        return;
    }

    if (hasHeadroom()) {
        bot.setControlState("jump", true);
        await new Promise((resolve) => setTimeout(resolve, 300));
        bot.setControlState("jump", false)
        await unstickSideways();
        return;
    }

    const blockers = getBlockingBlocks();
    let dugAny = false;

    for (const block of blockers) {
        if (isSolid(block) && bot.canDigBlock(block)) {
            try {
            await bot.dig(block)
            dugAny = true;
            } catch (err) {
                console.log(err.message)
            }
    }
}


    if (!dugAny) {
        bot.setControlState("jump", true);
        await new Promise((resolve) => setTimeout(resolve, 300));
        bot.setControlState("jump", false);
        await unstickSideways();
    }

    if (bot.pathfinder && bot.pathfinder.goal) {
        const goal= bot.pathfinder.goal;
        bot.pathfinder.setGoal(null);
        await new Promise((resolve) => setTimeout(resolve, 150));
        bot.pathfinder.setGoal(goal);
    }

}

const armorTiers = {
    leather: 1,
    golden: 2,
    chainmail: 3,
    turtle: 3,
    iron: 4,
    diamond: 5,
    netherite: 6
}

function getArmorTier(itemName) {
    for (const material in armorTiers) {
        if (itemName.startsWith(material)) {
            return armorTiers[material]
        }
    }
    return 0;
}

function getArmorSlot(itemName) {
    if (itemName.endsWith('_helmet') || itemName === 'turtle_helmet') return { dest: 'head', index: 5};
    if (itemName.endsWith('_chestplate')) return { dest: 'torso', index: 6 };
    if (itemName.endsWith('_leggings')) return { dest: 'legs', index: 7 };
    if (itemName.endsWith('_boots')) return { dest: 'feet', index: 8 };
    return null;
}

async function fightEntity(targetEntity) {
    await equipWeapon();
    bot.pvp.movements = defaultMove;
    bot.pvp.followRange = 2;
    bot.pvp.attack(targetEntity);

    await Promise.race([
        new Promise((resolve) => bot.once('stoppedAttacking', resolve)),
        timeout(20000).catch(() => {})
    ]);

    if (bot.pvp.target) {
        bot.pvp.stop();
    }
}

async function equipWeapon() {
        const weapon = bot.inventory.items().find((item) => {
            return item.name.includes('sword')
        })

        if (weapon) {
            await bot.equip(weapon, 'hand')
        }
    }

    let inCombat = false;

async function handleHostileThreat() {
    if (inCombat) return false;

    const mob = bot.nearestEntity((entity) => {
        return hostileMobs.includes(entity.name) && bot.entity.position.distanceTo(entity.position) <= 8;
    });

    if (!mob) return false;

    inCombat = true;
    const wasBusy = botBusy;
    console.log(`Combat: defense against ${mob.name}`);

        try{
            if (bot.pathfinder) bot.pathfinder.setGoal(null);
            try { await bot.collectBlock.cancelTask(); } catch (err) { }
            await fightEntity(mob);
        } finally {
            inCombat = false;
            botBusy = wasBusy;
        }

        return true;
    }

function getBotContextSummary() {
    const inventory = bot.inventory.items().length > 0 ? bot.inventory.items().map((item) => `${item.name} x${item.count}`).join(', ') : 'empty';

    const underBot = bot.blockAt(bot.entity.position.offset(0 , -1, 0));
    const lookingAt = bot.blockAtCursor(4);

    const nearbyEntities = Object.values(bot.entities)
        .filter((entity) => entity !== bot.entity && bot.entity.position.distanceTo(entity.position) <= 10)
        .map((entity) => entity.name || entity.username)
        .filter(Boolean)
        .slice(0, 8)
        .join(', ') || 'none';

        return `Bot inventory: ${inventory}. Standing on: ${underBot ? underBot.name : 'unknown'}. Looking at: ${lookingAt ? lookingAt.name : 'nothing in range'}. ${nearbyEntities}`;
}

async function equipBestArmor() {
    const bestPerSlot = {};

    for (const item of bot.inventory.items()) {
        const slot = getArmorSlot(item.name);
        if (!slot) continue;

        const current = bestPerSlot[slot.dest];
        if (!current || getArmorTier(item.name) > getArmorTier(current.name)) {
            bestPerSlot[slot.dest] = item;
        }
    }

    for (const dest in bestPerSlot) {
        const candidate = bestPerSlot[dest];
        const slotInfo = getArmorSlot(candidate.name)
        const worn = bot.inventory.slots[slotInfo.index];

        if (!worn || getArmorTier(candidate.name) > getArmorTier(worn.name)) {
            try {
                await bot.equip(candidate, dest);
                console.log(`New armor: ${candidate.name}`);

            } catch (err) {
                console.log(err.message)
            }
        }
    }
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

const stuckWatchdogInterval = setInterval(async () => {
    if (!bot.entity) return;

    if (Date.now() < watchdogCooldownUntil) return;

    const hasGoal = bot.pathfinder && bot.pathfinder.goal;
    const isPvpActive = bot.pvp && bot.pvp.target;
    const shouldBeActive = botBusy || followingPlayer || hasGoal || isPvpActive;

    if (!shouldBeActive) {
        watchdogLastPosition = null;
        watchdogStuckStreak = 0;
        watchdogRecoveryAttempts = 0;
        return;
    }

    const recentlyDug = bot.lastDigTime && (performance.now() - bot.lastDigTime < 2500);
    if (bot.targetDigBlock || recentlyDug || unsticking) {
        watchdogLastPosition = bot.entity.position.clone();
        return;
    }

    if (!watchdogLastPosition) {
        watchdogLastPosition = bot.entity.position.clone();
        return;
    }

    const moved = bot.entity.position.distanceTo(watchdogLastPosition);
    watchdogLastPosition = bot.entity.position.clone();

    if (moved >= 0.4) {
        watchdogStuckStreak = 0;
        watchdogRecoveryAttempts = 0;
        return;
    }

    watchdogStuckStreak++;
    console.log(`${date()} Watchdog: ${watchdogStuckStreak}, moved=${moved.toFixed(2)}`);

    if (watchdogStuckStreak < 2) {
        return;
    }

    watchdogStuckStreak = 0;
    watchdogRecoveryAttempts++;

    if (watchdogRecoveryAttempts > 4) {
        console.log(`${date()} Watchdog: too many recovery attempts`)
        if (bot.pathfinder) bot.pathfinder.setGoal(null);
        if (bot.pvp) bot.pvp.stop();
        botBusy = false;
        watchdogRecoveryAttempts = 0;
        watchdogCooldownUntil = Date.now() + 10000;
        return;
    }

    await forceUnstuck();
}, 2500)  

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

    if (Date.now() <  watchdogCooldownUntil) {
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
        await fightEntity(nearbyHostile);
        botBusy = false
        return
    }

    const player = bot.players[followingPlayer]
    if (!player || !player.entity) {
        return
    }

    const distanse = bot.entity.position.distanceTo(player.entity.position)

    if (distanse > 5) {
        const p = player.entity.position;
        bot.pathfinder.setMovements(defaultMove)
        bot.pathfinder.setGoal(new GoalNear(p.x, p.y, p.z, 3))


        lastPosition = bot.entity.position.clone();
    }
}, 2000)

bot.once('spawn', () => {
    console.log(`[${date()}] ${bot.username} active`);
    reconnectDelay = 5000;
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
    clearInterval(stuckWatchdogInterval) 
    console.log(`[${date()}] ${bot.username} disconnected (${reason}). Reconnecting...` )
    if (!reconnecting) {
        reconnecting = true;
        setTimeout(createBot, reconnectDelay)
        reconnectDelay = Math.min(reconnectDelay * 2, 60000);

    }
});

bot.on('kicked', (reason) => {
    clearInterval(followInternal)  
    clearInterval(stuckWatchdogInterval) 
    console.log(`[${date()}] ${bot.username} kicked (${JSON.stringify(reason)})`)
    if (!reconnecting) {
        reconnecting = true;
        setTimeout(createBot, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 60000);
    }
});

bot.on('error', (err) => {
    clearInterval(followInternal)  
    clearInterval(stuckWatchdogInterval) 
    console.log(`[${date()}] Error: ${err.message}`)
    if (!reconnecting) {
        reconnecting = true;
        setTimeout(createBot, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 60000);
    }
});

bot.on('entityHurt', (entity) => {
    if (entity !== bot.entity) return;
    handleHostileThreat();
})

bot.on('death', () => {
    botBusy = false;
    inCombat = false;
    unsticking = false;
    if (bot.pathfinder) bot.pathfinder.setGoal(null);
    if (bot.pvp) bot.pvp.stop();
});

bot.on('playerCollect', (collector, collected) => {
    if (collector !== bot.entity) return;
    setTimeout(equipBestArmor, 150);
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
        let failure = 0;
        let lastGatherPosition = null;

        const startY = Math.floor(bot.entity.position.y)

        while (collected < amount) {
            await handleHostileThreat();

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
            failure = 0;
            console.log("Successfully collected! Total:", collected)
            console.log("Block now:", bot.blockAt(targetBlock.position).name)
            console.log("Bot inventory:", bot.inventory.items().map(item => item.name + " x" + item.count))

            } catch (err) {
                console.log(`Failed to collect: ${err.message}`)
                failure++

                if (failure >= 3) {
                    console.log(failure)
                    return collected

                }
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

    const interpretation = await interpretCommand(message, getBotContextSummary())
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

        if (collected > 0) {
            try {
                const collectedItemStack = bot.inventory.items().find((item) => item.name === interpretation.block);
                if (collectedItemStack) {
                    await bot.toss(collectedItemStack.type, null, Math.min(collected, collectedItemStack.count));
                }
            } catch (err) {
                console.log(`Failed to give collected items: ${err.message}`)
            }
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

    if (interpretation.action === 'give') {
        if (botBusy) {
            bot.chat(translations.getMessage(interpretation.language, "busy"));
            return;
        }

        if (!target) {
            const dontseeyou = languages.getMessage(interpretation.language, 'dontSeeYou')
            bot.chat(`${dontseeyou}`)
            return;
        }

        const itemStack = bot.inventory.items().find((item) => item.name === interpretation.item);

        if (!itemStack) {
            const IdontHave = languages.getMessage(interpretation.language, 'IdontHave')
            bot.chat(`${IdontHave} ${interpretation.item}`);
            return;
        }

        botBusy = true;
        const amountToGive = Math.min(interpretation.amount || 1, itemStack.count);

        await goToPlayer(target);

        try {
            await bot.toss(itemStack.type, null, amountToGive);
            const HereYouGo = languages.getMessage(interpretation.language, 'HereYouGo')
            bot.chat(`${HereYouGo} ${amountToGive}x ${interpretation.item}`)
        } catch (err) {
            console.log(`Failed to give item: ${err.message}`)
            const giveError = languages.getMessage(interpretation.language, 'giveError');
        }
        botBusy = false;
        return;
    }

    if (interpretation.action === 'attack') {
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

            await fightEntity(targetEntity);
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

        if (!player) {
            const dontSeeYou = languages.getMessage(interpretation.language, "dontSeeYou")
            bot.chat(`${dontSeeYou}`)
            return
        }
        
        botBusy = true;
        await fightEntity(player.entity);
        botBusy = false;
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

    Current ${bot.username} situation: ${getBotContextSummary()} 

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