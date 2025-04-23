// bot.js
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { botConfig } = require('./src/managers/configManager');
const { registerEventHandlers } = require('./src/handlers/eventHandler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // 멤버 추가/스캔 위해 필요
    ]
});

registerEventHandlers(client);

process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

if (botConfig.token) {
    client.login(botConfig.token).then(client.user.setActivity('블랙리스트', { type: ActivityType.Watching })).catch(error => {
        console.error("봇 로그인 실패:", error.message);
        if (error.message.includes('Privileged Intent')) console.error("오류: GuildMembers Intent가 Discord 개발자 포털에서 활성화되지 않았을 수 있습니다.");
        process.exit(1);
    });
} else {
    console.error("오류: 봇 토큰이 config.json에 없습니다.");
    process.exit(1);
}