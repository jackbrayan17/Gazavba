const { initDatabase } = require('../config/database');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Status = require('../models/Status');

async function seedDatabase() {
  try {
    console.log('Initializing database...');
    await initDatabase();
    
    console.log('Seeding database with sample data...');
    
    // Create sample users
    const users = [
      { name: 'Brenda', email: 'brenda@example.com', phone: '+237612345678', avatar: 'https://i.pravatar.cc/120?img=3' },
      { name: 'Marcus', email: 'marcus@example.com', phone: '+237612345679', avatar: 'https://i.pravatar.cc/120?img=5' },
      { name: 'Elena', email: 'elena@example.com', phone: '+237612345680', avatar: 'https://i.pravatar.cc/120?img=2' },
      { name: 'Test User', email: 'test@example.com', phone: '+237612345681', avatar: 'https://i.pravatar.cc/120?img=1' }
    ];

    const createdUsers = [];
    for (const userData of users) {
      const user = await User.create(userData);
      createdUsers.push(user);
      console.log(`Created user: ${user.name}`);
    }

    // Set some users as online
    await User.setOnlineStatus(createdUsers[0].id, true);
    await User.setOnlineStatus(createdUsers[2].id, true);

    // Create sample chats
    const chat1 = await Chat.create({
      name: 'Direct Chat',
      type: 'direct',
      createdBy: createdUsers[0].id,
      participants: [createdUsers[0].id, createdUsers[1].id]
    });

    const chat2 = await Chat.create({
      name: 'Group Chat',
      type: 'group',
      createdBy: createdUsers[0].id,
      participants: [createdUsers[0].id, createdUsers[1].id, createdUsers[2].id]
    });

    // Create sample messages
    const messages = [
      { chatId: chat1.id, senderId: createdUsers[1].id, text: 'Hey! How\'s Gazavba?' },
      { chatId: chat1.id, senderId: createdUsers[0].id, text: 'Great! Building the backend 🚀' },
      { chatId: chat2.id, senderId: createdUsers[2].id, text: 'Let\'s meet at 4PM!' },
      { chatId: chat2.id, senderId: createdUsers[0].id, text: '🔥🔥🔥' }
    ];

    for (const messageData of messages) {
      await Message.create(messageData);
    }

    // Create sample statuses
    const statuses = [
      { userId: createdUsers[1].id, type: 'text', content: 'Working on Gazavba today!', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      { userId: createdUsers[2].id, type: 'text', content: 'Beautiful sunset today 🌅', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    ];

    for (const statusData of statuses) {
      await Status.create(statusData);
    }

    console.log('Database seeded successfully!');
    console.log('Sample users created:', createdUsers.length);
    console.log('Sample chats created: 2');
    console.log('Sample messages created:', messages.length);
    console.log('Sample statuses created:', statuses.length);
    
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

seedDatabase();
