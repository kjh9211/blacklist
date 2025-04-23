// commands.js
const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('블랙리스트')
        .setDescription('블랙리스트 관리 및 조회')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator) // 기본적으로 관리자만 보이도록 설정
        .setDMPermission(false) // 서버에서만 사용 가능
        .addSubcommand(subcommand =>
            subcommand.setName('등록').setDescription('사용자를 블랙리스트에 등록')
                .addUserOption(option => option.setName('대상').setDescription('등록할 사용자').setRequired(true))
                .addStringOption(option => option.setName('사유').setDescription('등록 사유').setRequired(true))
                .addAttachmentOption(option => option.setName('증거파일').setDescription('증거 파일 (선택)')))
        .addSubcommand(subcommand =>
            subcommand.setName('확인').setDescription('블랙리스트 목록 확인'))
        .addSubcommand(subcommand =>
            subcommand.setName('알림채널').setDescription('이 서버의 블랙리스트 알림 채널 설정')
                .addChannelOption(option => option.setName('채널').setDescription('알림받을 텍스트 채널').addChannelTypes(ChannelType.GuildText).setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('스캔').setDescription('현재 서버 내 블랙리스트 사용자 스캔')),

    new SlashCommandBuilder()
        .setName('자동차단설정')
        .setDescription('이 서버의 블랙리스트 자동 차단 설정')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator) // 관리자만 사용 가능
        .setDMPermission(false) // 서버에서만 사용 가능
        .addBooleanOption(option => option.setName('활성화').setDescription('자동 차단 기능 활성화 여부').setRequired(true))
];

module.exports = { commands };