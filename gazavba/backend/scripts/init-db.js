const { initDatabase } = require('../config/database');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Status = require('../models/Status');
const bcrypt = require('bcryptjs');

const sanitize = (user) => {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
};

async function seedDatabase() {
  try {
    console.log('Initializing database...');
    await initDatabase();

    console.log('Seeding database with sample data...');

    const superAdminPhone = '699999999';
    const superAdminEmail = 'superadmin@gazavba.com';

    const existingSuperAdmin = await User.getByPhone(superAdminPhone);
    if (!existingSuperAdmin) {
      const superAdminPassword = await bcrypt.hash('brayan8003', 10);
      const superAdmin = await User.create({
        name: 'Super Admin',
        email: superAdminEmail,
        phone: superAdminPhone,
        avatar: 'https://i.pravatar.cc/120?img=15',
        password: superAdminPassword,
        role: 'super_admin',
        isSuperAdmin: true,
      });
      console.log('Created super admin account with phone 699999999');
      console.log(`Super admin email: ${superAdmin.email}`);
    } else {
      console.log('Super admin account already exists, skipping creation.');
    }

    // Create sample users
    const users = [
      { name: 'Brenda', email: 'brenda@example.com', phone: '+237612345678', avatar: 'https://i.pravatar.cc/120?img=3' },
      { name: 'Marcus', email: 'marcus@example.com', phone: '+237612345679', avatar: 'https://i.pravatar.cc/120?img=5' },
      { name: 'Elena', email: 'elena@example.com', phone: '+237612345680', avatar: 'https://i.pravatar.cc/120?img=2' },
      { name: 'Test User', email: 'test@example.com', phone: '+237612345681', avatar: 'https://i.pravatar.cc/120?img=1' }
    ];

    const createdUsers = [];
    for (const userData of users) {
      const existing = await User.getByEmail(userData.email);
      if (existing) {
        console.log(`User already exists: ${existing.name}`);
        createdUsers.push(sanitize(existing));
        continue;
      }

      const password = await bcrypt.hash('password123', 10);
      const user = await User.create({ ...userData, password });
      createdUsers.push(user);
      console.log(`Created user: ${user.name}`);
    }

    // Set some users as online
    if (createdUsers[0]) await User.setOnlineStatus(createdUsers[0].id, true);
    if (createdUsers[2]) await User.setOnlineStatus(createdUsers[2].id, true);

    // Create sample chats
    const sampleChats = [];

    if (createdUsers.length >= 2) {
      const chat1 = await Chat.create({
        name: 'Direct Chat',
        type: 'direct',
        createdBy: createdUsers[0].id,
        participants: [createdUsers[0].id, createdUsers[1].id]
      });
      sampleChats.push(chat1);
    }

    if (createdUsers.length >= 3) {
      const chat2 = await Chat.create({
        name: 'Group Chat',
        type: 'group',
        createdBy: createdUsers[0].id,
        participants: [createdUsers[0].id, createdUsers[1].id, createdUsers[2].id]
      });
      sampleChats.push(chat2);
    }

    // Create sample messages
    let messageCount = 0;
    if (sampleChats.length > 0) {
      const messages = [];
      if (sampleChats[0] && createdUsers[1] && createdUsers[0]) {
        messages.push(
          { chatId: sampleChats[0].id, senderId: createdUsers[1].id, text: "Hey! How's Gazavba?" },
          { chatId: sampleChats[0].id, senderId: createdUsers[0].id, text: 'Great! Building the backend 🚀' }
        );
      }

      if (sampleChats[1] && createdUsers[2] && createdUsers[0]) {
        messages.push(
          { chatId: sampleChats[1].id, senderId: createdUsers[2].id, text: "Let's meet at 4PM!" },
          { chatId: sampleChats[1].id, senderId: createdUsers[0].id, text: '🔥🔥🔥' }
        );
      }

      for (const messageData of messages) {
        await Message.create(messageData);
        messageCount += 1;
      }
    }

    // Create sample statuses
    const statuses = [];
    if (createdUsers[1]) {
      statuses.push({
        userId: createdUsers[1].id,
        type: 'text',
        content: 'Working on Gazavba today!',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }

    if (createdUsers[2]) {
      statuses.push({
        userId: createdUsers[2].id,
        type: 'text',
        content: 'Beautiful sunset today 🌅',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }

    for (const statusData of statuses) {
      await Status.create(statusData);
    }

    console.log('Database seeded successfully!');
    console.log('Sample users prepared:', createdUsers.length);
    console.log(`Sample chats created: ${sampleChats.length}`);
    console.log('Sample messages created:', messageCount);
    console.log('Sample statuses created:', statuses.length);

  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

seedDatabase();
