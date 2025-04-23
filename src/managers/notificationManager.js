// src/managers/notificationManager.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getServerConfig } = require('./configManager');

async function sendNotification(client, channelId, embed, components = []) {
    if (!channelId) return false;
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed], components });
            return true;
        }
        console.warn(`채널 [${channelId}]을(를) 찾을 수 없거나 텍스트 채널이 아닙니다.`);
        return false;
    } catch (error) {
        console.error(`채널 [${channelId}]에 알림 전송 중 오류 발생:`, error.message);
        return false;
    }
}

function createBlacklistNotificationEmbed(blacklistEntry, targetUser, reporterUser) {
    const embed = new EmbedBuilder()
        .setTitle('⚠️ 블랙리스트 신규 등록 알림')
        .setColor('#FF0000')
        .setDescription(`새로운 사용자가 블랙리스트에 등록되었습니다.`)
        .addFields(
            { name: '대상 사용자', value: targetUser ? `${targetUser.tag} (${targetUser.id})` : `알 수 없음 (${blacklistEntry.userId})` },
            { name: '사유', value: blacklistEntry.reason || '사유 없음' },
            { name: '신고자', value: reporterUser ? `${reporterUser.tag} (${reporterUser.id})` : `알 수 없음 (${blacklistEntry.reporterId})` },
            { name: '등록 시간', value: `<t:${Math.floor(new Date(blacklistEntry.timestamp).getTime() / 1000)}:R>` }
        )
        .setTimestamp(new Date(blacklistEntry.timestamp));

    if (targetUser?.displayAvatarURL()) embed.setThumbnail(targetUser.displayAvatarURL());
    if (blacklistEntry.evidenceUrl) {
        if (/\.(jpeg|jpg|gif|png)$/i.test(blacklistEntry.evidenceUrl)) {
             embed.setImage(blacklistEntry.evidenceUrl);
             embed.addFields({ name: '증거 자료 (이미지)', value: `[이미지 링크](${blacklistEntry.evidenceUrl})` });
        } else {
             embed.addFields({ name: '증거 자료 (링크)', value: `[증거 링크](${blacklistEntry.evidenceUrl})` });
        }
    }
    return embed;
}

async function notifyServersOnBlacklist(blacklistEntry, client, banButtonCache) {
    const results = { success: [], failed: [] };
    let targetUser, reporterUser;
    try {
        targetUser = await client.users.fetch(blacklistEntry.userId).catch(() => null);
        reporterUser = await client.users.fetch(blacklistEntry.reporterId).catch(() => null);
    } catch (fetchError) {
        console.error("알림 전송 위한 사용자 정보 조회 중 오류:", fetchError);
    }
    const embed = createBlacklistNotificationEmbed(blacklistEntry, targetUser, reporterUser);

    for (const guild of client.guilds.cache.values()) {
        const guildConfig = getServerConfig(guild.id);
        const channelId = guildConfig.notificationChannelId;
        if (channelId) {
            let components = [];
            if (!guildConfig.autoban) {
                const banButton = new ButtonBuilder().setCustomId(`ban_${blacklistEntry.userId}`).setLabel('이 서버에서 차단하기').setStyle(ButtonStyle.Danger);
                components.push(new ActionRowBuilder().addComponents(banButton));
                const cacheKey = `${blacklistEntry.userId}_${guild.id}`;
                banButtonCache.set(cacheKey, { userId: blacklistEntry.userId, reason: blacklistEntry.reason, guildId: guild.id, timestamp: Date.now() });
            }
            const success = await sendNotification(client, channelId, embed, components);
            if (success) results.success.push({ guildId: guild.id, guildName: guild.name });
            else results.failed.push({ guildId: guild.id, guildName: guild.name, reason: `채널(${channelId}) 전송 실패` });
        }
    }
    console.log(`블랙리스트 알림 전송 완료: 성공 ${results.success.length}개, 실패 ${results.failed.length}개`);
    return results;
}

module.exports = { sendNotification, notifyServersOnBlacklist, createBlacklistNotificationEmbed };