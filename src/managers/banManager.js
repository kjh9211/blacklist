// src/managers/banManager.js
const { sendNotification } = require('./notificationManager');
const { getServerConfig } = require('./configManager');
const { EmbedBuilder } = require('discord.js');

async function banUserFromGuild(userId, guild, reason, actorId = '자동 시스템') {
    try {
        const member = await guild.members.fetch(userId).catch(() => null);
        const logReason = `블랙리스트 봇: ${reason} (실행자: ${actorId})`;
        await guild.members.ban(userId, { reason: logReason, deleteMessageSeconds: 0 });
        const successMsg = `사용자 ${member ? member.user.tag : userId} 님을 서버 [${guild.name}]에서 성공적으로 차단했습니다. (사유: ${reason})`;
        console.log(successMsg);
        return { success: true, message: successMsg };
    } catch (error) {
        let errorMessage = `사용자 ${userId} 님을 서버 [${guild.name}]에서 차단하는 중 오류 발생: ${error.message}`;
        if (error.code === 50013) errorMessage = `서버 [${guild.name}]에서 사용자를 차단할 권한이 없습니다.`;
        else if (error.code === 10007 || error.code === 10013) errorMessage = `사용자 ${userId} 님을 찾을 수 없거나 차단할 수 없습니다. (오류: ${error.message})`;
        console.error(errorMessage);
        return { success: false, message: errorMessage, error: error.message };
    }
}

async function handleAutoBanOnJoin(member, blacklistEntry, client) {
    const guild = member.guild;
    const guildConfig = getServerConfig(guild.id);
    if (!guildConfig.autoban) return;

    console.log(`서버 [${guild.name}] 자동 차단 활성화: 블랙리스트 사용자 [${member.user.tag}(${member.user.id})] 입장 감지.`);
    const banResult = await banUserFromGuild(member.user.id, guild, `자동 차단: ${blacklistEntry.reason}`, client.user.id);

    const notificationChannelId = guildConfig.notificationChannelId;
    if (notificationChannelId) {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ 자동 차단 실행됨')
            .setColor(banResult.success ? '#FFA500' : '#FF0000')
            .setDescription(`블랙리스트 사용자 **${member.user.tag} (${member.user.id})** 님의 서버 입장이 감지되어 자동으로 차단 ${banResult.success ? '되었습니다' : '시도했으나 실패했습니다'}.`)
            .addFields({ name: '블랙리스트 사유', value: blacklistEntry.reason }, { name: '차단 결과', value: banResult.message })
            .setTimestamp();
        await sendNotification(client, notificationChannelId, embed);
    }
}

module.exports = { banUserFromGuild, handleAutoBanOnJoin };