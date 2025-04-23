// src/managers/configManager.js
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../config.json');
const SERVER_CONFIGS_FILE = path.join(__dirname, '../../serverConfigs.json');

let botConfig = {};
try {
    if (fs.existsSync(CONFIG_FILE)) {
        botConfig = require(CONFIG_FILE);
    } else {
        console.error('오류: config.json 파일을 찾을 수 없습니다.');
        process.exit(1);
    }
} catch (error) {
    console.error('config.json 로드 중 오류 발생:', error);
    process.exit(1);
}

let serverConfigs = {};

function loadServerConfigs() {
    try {
        if (fs.existsSync(SERVER_CONFIGS_FILE)) {
            const data = fs.readFileSync(SERVER_CONFIGS_FILE, 'utf8');
            return data.trim() === '' ? {} : JSON.parse(data);
        }
        saveServerConfigs({});
        return {};
    } catch (error) {
        console.error('서버 설정 데이터 로드 중 오류 발생:', error);
        return {};
    }
}

function saveServerConfigs(data) {
    try {
        fs.writeFileSync(SERVER_CONFIGS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('서버 설정 데이터 저장 중 오류 발생:', error);
    }
}

serverConfigs = loadServerConfigs();

function getServerConfig(guildId) {
    const defaultConfig = {
        notificationChannelId: null,
        autoban: false
    };
    return { ...defaultConfig, ...(serverConfigs[guildId] || {}) };
}

function setServerConfig(guildId, key, value) {
    if (!serverConfigs[guildId]) {
        serverConfigs[guildId] = {};
    }
    serverConfigs[guildId][key] = value;
    saveServerConfigs(serverConfigs);
}

function setNotificationChannel(guildId, channelId) {
    setServerConfig(guildId, 'notificationChannelId', channelId);
    console.log(`서버 [${guildId}]의 알림 채널이 [${channelId}]로 설정되었습니다.`);
}

function setAutoBan(guildId, enabled) {
    setServerConfig(guildId, 'autoban', enabled);
    console.log(`서버 [${guildId}]의 자동 차단이 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
}

module.exports = {
    botConfig,
    loadServerConfigs,
    saveServerConfigs,
    getServerConfig,
    setNotificationChannel,
    setAutoBan,
};