/* eslint-env node */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { run, all, get } = require('../config/database');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Status = require('../models/Status');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_PATH = path.resolve(process.cwd(), process.env.UPLOAD_PATH || 'uploads');
const BG_PATH = path.join(UPLOAD_PATH, 'backgrounds');

// Crée les dossiers nécessaires
function ensureDirectories() {
  [UPLOAD_PATH, BG_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Crée des faux fonds d'écran si absents
function ensureSampleBackgrounds() {
  const backgrounds = [
    'bg-alice.jpg',
    'bg-boris.jpg',
    'bg-carmen.jpg',
    'bg-diego.jpg',
    'bg-estelle.jpg',
    'bg-team.jpg',
    'bg-default.jpg',
  ];

  backgrounds.forEach(name => {
    const filePath = path.join(BG_PATH, name);
    if (!fs.existsSync(filePath)) {
      // Petit fichier vide valide (1x1 pixel transparent ou couleur)
      fs.writeFileSync(filePath, Buffer.from('FAKE_BG_DATA', 'utf8'));
    }
  });

  return backgrounds.reduce((acc, name) => {
    acc[name] = `/uploads/backgrounds/${name}`;
    return acc;
  }, {});
}

// Crée des médias d'exemple
function ensureSampleMedia() {
  const files = [
    'sample-image.jpg',
    'sample-video.mp4',
  ];

  files.forEach(name => {
    const filePath = path.join(UPLOAD_PATH, name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, Buffer.from(`FAKE_${name.toUpperCase()}`, 'utf8'));
    }
  });

  return {
    imageUrl: '/uploads/sample-image.jpg',
    videoUrl: '/uploads/sample-video.mp4',
  };
}

// Masque le mot de passe dans les logs
const sanitize = u => (u ? (({ password, ...rest }) => rest)(u) : null);

async function seedDatabase() {
  try {
    console.log('Seeding database... (December 05, 2025)');

    ensureDirectories();
    const bgUrls = ensureSampleBackgrounds();
    const { imageUrl, videoUrl } = ensureSampleMedia();

    // === 1. Utilisateurs ===
    const rawUsers = [
      {
        name: 'Alice',
        email: 'alice@gazavba.local',
        phone: '+237690000101',
        avatar: 'https://i.pravatar.cc/120?img=11',
        bio: 'Développeuse backend passionnée par Node.js et MySQL. Basée à Yaoundé.',
        statusPrivacy: 'private',
      },
      {
        name: 'Boris',
        email: 'boris@gazavba.local',
        phone: '+237690000102',
        avatar: 'https://i.pravatar.cc/120?img=12',
        bio: 'Designer UI/UX | Amoureux du bleu ciel et des chats. Douala.',
        statusPrivacy: 'private',
      },
      {
        name: 'Carmen',
        email: 'carmen@gazavba.local',
        phone: '+237690000103',
        avatar: 'https://i.pravatar.cc/120?img=13',
        bio: 'Chef de projet agile | Café addict. Organise tout avec Trello.',
        statusPrivacy: 'general',
      },
      {
        name: 'Diego',
        email: 'diego@gazavba.local',
        phone: '+237690000104',
        avatar: 'https://i.pravatar.cc/120?img=14',
        bio: 'DevOps | Cloud & Kubernetes. Toujours en train de déployer.',
        statusPrivacy: 'private',
      },
      {
        name: 'Estelle',
        email: 'estelle@gazavba.local',
        phone: '+237690000105',
        avatar: 'https://i.pravatar.cc/120?img=15',
        bio: 'Marketing digital | Yaoundé. Spécialiste TikTok & Instagram.',
        statusPrivacy: 'general',
      },
    ];

    const passHash = await bcrypt.hash('password123', 10);
    const created = [];

    for (const u of rawUsers) {
      const existing = await get(`SELECT id FROM users WHERE email = ?`, [u.email]);
      if (existing ? await User.getById(existing.id) : await User.create({
        ...u,
        password: passHash,
      })).then(user => {
        created.push(sanitize(user));
        console.log(`${existing ? 'Utilisateur déjà présent' : 'Utilisateur créé'} : ${u.name}`);
      });
    }

    // Attente que tous les utilisateurs soient bien créés
    while (created.length < rawUsers.length) {
      await new Promise(r => setTimeout(r, 100));
    }

    // Online pour Alice et Carmen
    await User.setOnlineStatus(created[0].id, true);
    await User.setOnlineStatus(created[2].id, true);

    // CORRIGÉ : nom de colonne correct = backgroundGlobal
    const globalBgs = {
      [created[0].id]: bgUrls['bg-default.jpg'],
      [created[1].id]: bgUrls['bg-default.jpg'],
      [created[2].id]: bgUrls['bg-carmen.jpg'],
      [created[3].id]: null,
      [created[4].id]: bgUrls['bg-estelle.jpg'],
    };

    for (const [userId, bg] of Object.entries(globalBgs)) {
      if (bg) {
        await run(`UPDATE users SET backgroundGlobal = ? WHERE id = ?`, [bg, userId]);
      }
    }

    // === 2. Chats directs & groupes ===
    let directChatId;
    if (created[0] && created[1]) {
      directChatId = await Chat.ensureDirectChatBetween(created[0].id, created[1].id);
      await run(
        `INSERT INTO user_chat_settings (id, userId, chatId, background) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE background = VALUES(background)`,
        [uuidv4(), created[0].id, directChatId, bgUrls['bg-alice.jpg']]
      );
      await run(
        `INSERT INTO user_chat_settings (id, userId, chatId, background) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE background = VALUES(background)`,
        [uuidv4(), created[1].id, directChatId, bgUrls['bg-boris.jpg']]
      );
    }

    // Groupe Équipe Gazavba
    const [existingGroup] = await all(`SELECT id FROM chats WHERE name = ? AND type = 'group'`, ['Équipe Gazavba']);
    let groupChat;
    if (existingGroup) {
      groupChat = await Chat.getById(existingGroup.id);
    } else {
      groupChat = await Chat.createGroup({
        name: 'Équipe Gazavba',
        createdBy: created[0].id,
        participants: created.slice(0, 4).map(u => u.id),
        admins: [created[0].id],
        background: bgUrls['bg-team.jpg'],
      });
    }

    // Fonds personnalisés dans le groupe
    const groupOverrides = [
      { userId: created[0].id, bg: bgUrls['bg-alice.jpg'] },
      { userId: created[2].id, bg: bgUrls['bg-carmen.jpg'] },
      { userId: created[3].id, bg: bgUrls['bg-diego.jpg'] },
    ];
    for (const { userId, bg } of groupOverrides) {
      await run(
        `INSERT INTO user_chat_settings (id, userId, chatId, background) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE background = VALUES(background)`,
        [uuidv4(), userId, groupChat.id, bg]
      );
    }

    // === 3. Messages ===
    const messagesToCreate = [];

    if (directChatId) {
      messagesToCreate.push(
        { chatId: directChatId, senderId: created[1].id, text: 'Salut Alice ! Tout avance ?', messageType: 'text', clientId: uuidv4() },
        { chatId: directChatId, senderId: created[0].id, text: 'Oui, on met en place le backend', messageType: 'text', clientId: uuidv4() }
      );
    }

    if (groupChat) {
      messagesToCreate.push(
        { chatId: groupChat.id, senderId: created[2].id, text: 'Partage du plan en pièce jointe', messageType: 'file', mediaUrl: imageUrl, mediaName: 'plan.jpg', clientId: uuidv4() },
        { chatId: groupChat.id, senderId: created[0].id, text: 'Voici une courte vidéo', messageType: 'video', mediaUrl: videoUrl, mediaName: 'demo.mp4', clientId: uuidv4() }
      );
    }

    for (const m of messagesToCreate) {
      await Message.create(m);
    }

    // === 4. Statuts ===
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    const statuses = [
      { userId: created[1]?.id, type: 'text', content: 'Journée chargée sur Gazavba', expiresAt },
      { userId: created[2]?.id, type: 'image', content: 'Design du jour', mediaUrl: imageUrl, expiresAt },
      { userId: created[3]?.id, type: 'video', content: 'Mini demo', mediaUrl: videoUrl, expiresAt },
    ].filter(s => s.userId);

    for (const s of statuses) {
      await Status.create(s);
    }

    // === 5. Accusés de lecture (exemple) ===
    if (directChatId) {
      const msgs = await Message.getByChatId(directChatId, created[0].id, 10);
      const toMark = msgs
        .filter(m => m.senderId !== created[0].id && !m.readAt)
        .slice(0, 2)
        .map(m => m.id);

      if (toMark.length) {
        await Message.markAsReadBatch(toMark, created[0].id);
      }
    }

    console.log('\nSEED TERMINÉ AVEC SUCCÈS !');
    console.table(created.map(u => ({
      name: u.name,
      email: u.email,
      privacy: u.statusPrivacy || 'private',
    })));

    console.log(`Utilisateurs: ${created.length} | Messages: ${messagesToCreate.length} | Statuts: ${statuses.length}`);
    console.log(`Dossier uploads : ${UPLOAD_PATH}`);

  } catch (error) {
    console.error('SEED ÉCHOUÉ:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { seedDatabase };