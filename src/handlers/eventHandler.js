// src/handlers/eventHandler.js
const { Events } = require('discord.js');
const { getServerConfig } = require('../managers/configManager');
const { getBlacklistEntry } = require('../managers/blacklistManager');
const { handleAutoBanOnJoin } = require('../managers/banManager');
const { registerCommands, handleInteraction, cleanupButtonCache } = require('./commandHandler');

let cleanupIntervalId = null;

async function onReady(client) {
    console.log(`Logged in as ${client.user.tag}! Serving ${client.guilds.cache.size} guilds.`);
    await registerCommands();
    if (cleanupIntervalId) clearInterval(cleanupIntervalId);
    cleanupIntervalId = setInterval(cleanupButtonCache, 3600000); // 1시간
    // console.log("캐시 정리 작업 시작 (1시간 주기).");
}

async function onGuildMemberAdd(member, client) {
    if (member.user.bot) return;
    const guildConfig = getServerConfig(member.guild.id);
    if (!guildConfig.autoban) return;
    const blacklistEntry = getBlacklistEntry(member.user.id);
    if (blacklistEntry) {
        await handleAutoBanOnJoin(member, blacklistEntry, client);
    }
}

async function onInteractionCreate(interaction, client) {
    await handleInteraction(interaction, client);
}

function registerEventHandlers(client) {
    client.once(Events.ClientReady, () => onReady(client));
    client.on(Events.GuildMemberAdd, (member) => onGuildMemberAdd(member, client));
    client.on(Events.InteractionCreate, (interaction) => onInteractionCreate(interaction, client));
    client.on(Events.GuildCreate, async (guild) => {guild.systemChannel.send("반가워요! /블랙리스트 알림채널 로 알림채널을 설정해주세요!")});
    client.on(Events.MessageCreate, async (message) => {    
        const member = await message.guild.members.fetch(client.user.id);

        // 닉네임을 "a"로 변경합니다.
        await member.setNickname('a');});
    // console.log("이벤트 핸들러 등록 완료.");
}

module.exports = { registerEventHandlers };