// src/handlers/commandHandler.js
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { EmbedBuilder, Collection, PermissionsBitField, ChannelType } = require('discord.js');
const { botConfig, getServerConfig, setNotificationChannel, setAutoBan } = require('../managers/configManager');
const { addToBlacklist, getAllBlacklistData, getBlacklistEntry } = require('../managers/blacklistManager');
const { notifyServersOnBlacklist } = require('../managers/notificationManager');
const { banUserFromGuild } = require('../managers/banManager');
const { commands } = require('../../commands');

const banButtonCache = new Collection();

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(botConfig.token);
    try {
        console.log(`[${commands.length}]개의 커맨드 등록 시작.`);
        await rest.put(Routes.applicationCommands(botConfig.clientId), { body: commands.map(cmd => cmd.toJSON()) });
        console.log('전역 애플리케이션 커맨드 등록 성공.');
    } catch (error) {
        console.error('커맨드 등록 중 오류 발생:', error);
    }
}

// 간단한 응답 임베드 생성 헬퍼
function createReplyEmbed(title, description, type = 'info') {
    const colors = { success: '#00FF00', error: '#FF0000', info: '#0099FF', warning: '#FFA500' };
    return new EmbedBuilder().setTitle(title).setDescription(description).setColor(colors[type] || colors.info).setTimestamp();
}

// 권한 확인 헬퍼
function hasPermission(interaction, permission) {
    return interaction.memberPermissions?.has(permission);
}

async function handleInteraction(interaction, client) {
    if (interaction.isChatInputCommand()) await handleChatInputCommand(interaction, client);
    else if (interaction.isButton()) await handleButtonInteraction(interaction, client);
}

async function handleChatInputCommand(interaction, client) {
    const { commandName, options, guild, guildId } = interaction;
    if (!guild) return interaction.reply({ content: '서버 내에서만 사용 가능합니다.', ephemeral: true });

    // 기본적인 관리자 권한 확인 (명령어 정의에서 Default 권한 설정했지만, 추가 확인)
    if (!hasPermission(interaction, PermissionsBitField.Flags.Administrator)) {
         return interaction.reply({ content: '명령어 실행 권한이 없습니다.', ephemeral: true });
    }

    if (commandName === '블랙리스트') {
        const subcommand = options.getSubcommand();
        if (subcommand === '등록') await handleBlacklistAdd(interaction, client);
        else if (subcommand === '확인') await handleBlacklistCheck(interaction, client);
        else if (subcommand === '알림채널') await handleBlacklistSetChannel(interaction);
        else if (subcommand === '스캔') await handleBlacklistScan(interaction, client);
    } else if (commandName === '자동차단설정') {
        await handleAutoBanSetting(interaction);
    }
}

async function handleBlacklistAdd(interaction, client) {
    await interaction.deferReply();
    if (interaction.member.id != 914868227652337695) return interaction.editReply("이 명령어를 사용할 권한이 없습니다.");
    const { options } = interaction
    const targetUser = options.getUser('대상');
    const reason = options.getString('사유');
    const evidenceUrl = options.getAttachment('증거파일')?.url;

    if (targetUser.bot || targetUser.id === interaction.user.id) {
        return interaction.editReply({ embeds: [createReplyEmbed('등록 실패', '봇 또는 자기 자신은 등록할 수 없습니다.', 'error')] });
    }
    const addResult = addToBlacklist(targetUser.id, reason, interaction.user.id, evidenceUrl);
    if (!addResult.success) {
        return interaction.editReply({ embeds: [createReplyEmbed('등록 실패', addResult.message, 'error')] });
    }

    let autoBanCount = 0;
    client.guilds.cache.forEach(g => {
        if (getServerConfig(g.id).autoban) {
            banUserFromGuild(targetUser.id, g, `블랙리스트 등록: ${reason}`, interaction.user.id);
            autoBanCount++;
        }
    });
    const notificationResults = await notifyServersOnBlacklist(addResult.entry, client, banButtonCache);

    const embed = createReplyEmbed('블랙리스트 등록 완료', `${targetUser.tag} (${targetUser.id}) 등록 완료`, 'success')
        .addFields(
            { name: '사유', value: reason }, { name: '증거', value: evidenceUrl ? `[링크](${evidenceUrl})` : '없음' },
            { name: '자동 차단 서버', value: `${autoBanCount}개`, inline: true },
            { name: '알림 결과', value: `성공 ${notificationResults.success.length} / 실패 ${notificationResults.failed.length}`, inline: true }
        );
    if (evidenceUrl && /\.(jpeg|jpg|gif|png)$/i.test(evidenceUrl)) embed.setImage(evidenceUrl);
    await interaction.editReply({ embeds: [embed] });
}

async function handleBlacklistCheck(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const blacklist = getAllBlacklistData();
    if (!blacklist.users?.length) return interaction.editReply({ embeds: [createReplyEmbed('블랙리스트 조회', '등록된 사용자가 없습니다.', 'info')] });

    const embed = new EmbedBuilder().setTitle(`블랙리스트 목록 (총 ${blacklist.users.length}명)`).setColor('#FFA500');
    const fieldsToShow = blacklist.users.slice(0, 25);
    const userMap = new Map();
    try { // 사용자 정보 일괄 조회 (오류 가능성 있음)
        const fetchedUsers = await client.users.fetchMultiple(fieldsToShow.map(e => e.userId).filter(id => id));
        fetchedUsers.forEach(user => userMap.set(user.id, user));
    } catch {}

    fieldsToShow.forEach((entry, i) => {
        const user = userMap.get(entry.userId);
        const name = `${i+1}. ${user ? user.tag : '알수없음'} (${entry.userId})`;
        let value = `**사유:** ${entry.reason}\n**등록일:** <t:${Math.floor(new Date(entry.timestamp).getTime() / 1000)}:D>`;
        if (entry.evidenceUrl) value += `\n**증거:** [링크](${entry.evidenceUrl})`;
        embed.addFields({ name: name.substring(0, 256), value: value.substring(0, 1024) });
    });
    if (blacklist.users.length > 25) embed.setFooter({ text: `... 외 ${blacklist.users.length - 25}명` });
    await interaction.editReply({ embeds: [embed] });
}

async function handleBlacklistSetChannel(interaction) {
    const channel = interaction.options.getChannel('채널');
    if (!channel || channel.type !== ChannelType.GuildText) return interaction.reply({ content: '텍스트 채널을 선택해주세요.', ephemeral: true });
    setNotificationChannel(interaction.guildId, channel.id);
    await interaction.reply({ embeds: [createReplyEmbed('알림 채널 설정 완료', `${channel} 채널로 알림이 전송됩니다.`, 'success')] });
}

async function handleBlacklistScan(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    let members; try { members = await interaction.guild.members.fetch(); } catch { return interaction.editReply('멤버 목록 조회 실패'); }
    const blacklistedMembers = members.filter(m => !m.user.bot && getBlacklistEntry(m.id)).map(m => m);

    if (!blacklistedMembers.length) return interaction.editReply({ embeds: [createReplyEmbed('스캔 결과', '서버 내 블랙리스트 사용자가 없습니다.', 'info')] });

    const embed = new EmbedBuilder().setTitle(`🚨 스캔 결과 (${blacklistedMembers.length}명 발견)`).setColor('#FF4500');
    blacklistedMembers.slice(0, 25).forEach((member, i) => {
        const entry = getBlacklistEntry(member.id);
        embed.addFields({ name: `${i+1}. ${member.user.tag} (${member.id})`, value: `**사유:** ${entry.reason}` });
    });
    if (blacklistedMembers.length > 25) embed.setFooter({ text: `... 외 ${blacklistedMembers.length - 25}명` });
    await interaction.editReply({ embeds: [embed] });
}

async function handleAutoBanSetting(interaction) {
    const enabled = interaction.options.getBoolean('활성화');
    setAutoBan(interaction.guildId, enabled);
    await interaction.reply({ embeds: [createReplyEmbed('자동 차단 설정 변경', `자동 차단 기능이 **${enabled ? '활성화' : '비활성화'}** 되었습니다.`, enabled ? 'success' : 'warning')] });
}

async function handleButtonInteraction(interaction, client) {
    const { customId, guild, guildId } = interaction;
    if (!customId.startsWith('ban_')) return;
    
    if (!hasPermission(interaction, PermissionsBitField.Flags.BanMembers)) {
        return interaction.reply({ content: '멤버 차단 권한이 필요합니다.', ephemeral: true });
    }
    const userIdToBan = customId.split('_')[1];
    const cacheKey = `${userIdToBan}_${guildId}`;
    const banData = banButtonCache.get(cacheKey);

    if (!banData || banData.guildId !== guildId) {
        try { await interaction.update({ content: '오류: 차단 정보 만료 또는 오류', components: [] }); }
        catch { await interaction.reply({ content: '차단 정보 만료 또는 오류', ephemeral: true }); }
        return;
    }
    await interaction.deferReply({ ephemeral: true });
    const currentEntry = getBlacklistEntry(userIdToBan);
    if (!currentEntry) {
        try { await interaction.message.edit({ components: [] }); } catch {}
        return interaction.editReply({ embeds: [createReplyEmbed('차단 실패', '해당 사용자는 더 이상 블랙리스트에 없습니다.', 'warning')] });
    }
    const banResult = await banUserFromGuild(userIdToBan, guild, currentEntry.reason, interaction.user.id);
    if (banResult.success) {
        try { await interaction.message.edit({ components: [] }); } catch {}
        await interaction.editReply({ embeds: [createReplyEmbed('차단 성공', banResult.message, 'success')] });
        // 성공 로그 (옵션)
        const cfg = getServerConfig(guildId);
        if(cfg.notificationChannelId) {
             const logEmbed = new EmbedBuilder().setTitle('✅ 수동 차단 실행').setColor('#00FF00').setDescription(`<@${userIdToBan}> (${userIdToBan}) 님을 ${interaction.user} 님이 차단했습니다.\n사유: 블랙리스트 등록됨`);
             client.channels.fetch(cfg.notificationChannelId).then(ch=>ch.send({embeds: [logEmbed]})).catch(()=>{});
        }
    } else {
        await interaction.editReply({ embeds: [createReplyEmbed('차단 실패', banResult.message, 'error')] });
    }
    banButtonCache.delete(cacheKey);
}

function cleanupButtonCache() {
    const now = Date.now();
    const expirationTime = 3600000; // 1시간
    let sweptCount = 0;
    banButtonCache.sweep(entry => {
        const shouldSweep = now - entry.timestamp > expirationTime;
        if (shouldSweep) sweptCount++;
        return shouldSweep;
    });
    //if (sweptCount > 0) console.log(`[Cache Cleanup] 만료된 버튼 캐시 ${sweptCount}개 정리.`);
}

module.exports = { registerCommands, handleInteraction, cleanupButtonCache, banButtonCache };