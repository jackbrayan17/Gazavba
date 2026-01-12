/* eslint-env node */
require('dotenv').config({ path: '../.env' });
const { initDatabase, closeDatabase, all } = require('../config/database');
const Chat = require('../models/Chat');

async function debugChats() {
    try {
        await initDatabase();
        console.log('Database initialized.');

        // 1. Fetch all users
        const users = await all('SELECT id, name, email FROM users');
        console.log(`Found ${users.length} users.`);

        for (const user of users) {
            console.log(`\n=== Debugging for User: ${user.name} (${user.id}) ===`);

            // 2. Fetch chats for this user
            const chats = await Chat.getByUserId(user.id);
            console.log(`Found ${chats.length} chats.`);

            for (const chat of chats) {
                console.log(`  Chat ID: ${chat.id}, Type: ${chat.type}, Name: ${chat.name}`);

                // 3. Fetch participants
                const participants = await Chat.getParticipants(chat.id);
                console.log(`    Participants (${participants.length}):`);
                participants.forEach(p => {
                    console.log(`      - ${p.name} (${p.id}) [${p.id === user.id ? 'SELF' : 'PEER'}]`);
                });

                // 4. Simulate logic from routes/chats.js
                let displayName = 'Conversation';
                let otherParticipant = null;

                if (chat.type === 'group') {
                    displayName = `${chat.name || 'Groupe'} - ${participants.length} membres`;
                } else {
                    const peer = participants.find(p => p.id !== user.id);
                    if (peer) {
                        displayName = peer.name;
                        otherParticipant = { id: peer.id, name: peer.name };
                    } else {
                        console.log('    [WARNING] No peer found for direct chat!');
                    }
                }
                console.log(`    Calculated DisplayName: "${displayName}"`);
            }
        }

    } catch (error) {
        console.error('Debug failed:', error);
    } finally {
        await closeDatabase();
        // Force exit because Redis/MySQL might keep event loop open
        process.exit(0);
    }
}

debugChats();
