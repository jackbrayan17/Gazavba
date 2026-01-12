/* eslint-env node */
const { run, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Poll {
    static async create(data) {
        const { question, options, allowMultiple } = data;
        const id = uuidv4();
        // Options: [{id: 'opt1', text: 'Yes'}, ...]
        await run(
            `INSERT INTO polls (id, question, options, allowMultiple) VALUES (?, ?, ?, ?)`,
            [id, question, JSON.stringify(options), allowMultiple ? 1 : 0]
        );
        return { id, question, options, allowMultiple, votes: {} };
    }

    static async getById(id) {
        const [row] = await all(`SELECT * FROM polls WHERE id = ? LIMIT 1`, [id]);
        if (!row) return null;

        // Get votes
        const votes = await all(`SELECT userId, optionId FROM poll_votes WHERE pollId = ?`, [id]);
        const voteMap = {}; // { opt1: [userId1, userId2], ... }
        votes.forEach(v => {
            if (!voteMap[v.optionId]) voteMap[v.optionId] = [];
            voteMap[v.optionId].push(v.userId);
        });

        return {
            ...row,
            options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
            allowMultiple: !!row.allowMultiple,
            votes: voteMap
        };
    }

    static async vote(pollId, userId, optionId) {
        const poll = await this.getById(pollId);
        if (!poll) throw new Error('POLL_NOT_FOUND');

        if (!poll.allowMultiple) {
            // Remove previous vote if not allowing multiple
            await run(`DELETE FROM poll_votes WHERE pollId = ? AND userId = ?`, [pollId, userId]);
        }

        // Toggle vote if same option? Or just add? Let's assume add for now, but check if exists
        const [existing] = await all(`SELECT 1 FROM poll_votes WHERE pollId=? AND userId=? AND optionId=?`, [pollId, userId, optionId]);
        if (existing) {
            await run(`DELETE FROM poll_votes WHERE pollId=? AND userId=? AND optionId=?`, [pollId, userId, optionId]);
        } else {
            await run(`INSERT INTO poll_votes (pollId, userId, optionId) VALUES (?, ?, ?)`, [pollId, userId, optionId]);
        }

        return this.getById(pollId);
    }
}

module.exports = Poll;
