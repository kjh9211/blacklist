// src/managers/blacklistManager.js
const fs = require('fs');
const path = require('path');

const BLACKLIST_FILE = path.join(__dirname, '../../blacklist.json');
let blacklistData = { users: [] };

function loadBlacklistData() {
    try {
        if (fs.existsSync(BLACKLIST_FILE)) {
            const data = fs.readFileSync(BLACKLIST_FILE, 'utf8');
            return data.trim() === '' ? { users: [] } : JSON.parse(data);
        }
        saveBlacklistData({ users: [] });
        return { users: [] };
    } catch (error) {
        console.error('블랙리스트 데이터 로드 중 오류 발생:', error);
        return { users: [] };
    }
}

function saveBlacklistData(data) {
    try {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(data, null, 2));
        blacklistData = data; // 메모리 캐시 업데이트
    } catch (error) {
        console.error('블랙리스트 데이터 저장 중 오류 발생:', error);
    }
}

blacklistData = loadBlacklistData();

function addToBlacklist(userId, reason, reporterId, evidenceUrl = null) {
    if (blacklistData.users.find(user => user.userId === userId)) {
        return { success: false, message: '이미 블랙리스트에 등록된 사용자입니다.' };
    }
    const blacklistEntry = { userId, reason, reporterId, evidenceUrl, timestamp: new Date().toISOString() };
    const updatedData = { ...blacklistData, users: [...blacklistData.users, blacklistEntry] };
    saveBlacklistData(updatedData);
    console.log(`사용자 [${userId}]가 블랙리스트에 추가되었습니다. 사유: ${reason}`);
    return { success: true, message: '사용자가 블랙리스트에 성공적으로 추가되었습니다.', entry: blacklistEntry };
}

function getBlacklistEntry(userId) {
    return blacklistData.users.find(user => user.userId === userId) || null;
}

function getAllBlacklistData() {
    return blacklistData;
}

module.exports = {
    loadBlacklistData,
    saveBlacklistData,
    addToBlacklist,
    getBlacklistEntry,
    getAllBlacklistData,
};