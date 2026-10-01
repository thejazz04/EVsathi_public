import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

console.log('========================================');
console.log('  EVsathi - MongoDB Connection Tester');
console.log('========================================');
console.log('');

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('❌ MONGODB_URI is not defined in .env file');
  process.exit(1);
}

// Mask password in logs
const maskedUri = mongoUri.replace(/:([^@]+)@/, ':****@');
console.log(`Testing connection to: ${maskedUri}`);
console.log('');

console.log('Attempting to connect...');
console.log('(This may take 10-30 seconds)');
console.log('');

const startTime = Date.now();

mongoose.connect(mongoUri, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
})
  .then((conn) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('✅ MongoDB Connection Successful!');
    console.log('');
    console.log('Connection Details:');
    console.log(`  - Host: ${conn.connection.host}`);
    console.log(`  - Database: ${conn.connection.name}`);
    console.log(`  - Connection Time: ${elapsed}s`);
    console.log('');
    
    // Test a simple query
    console.log('Testing database query...');
    return conn.connection.db.collection('users').countDocuments();
  })
  .then((count) => {
    console.log(`✅ Query successful! Found ${count} users in database.`);
    console.log('');
    console.log('========================================');
    console.log('✅ MongoDB is working correctly!');
    console.log('========================================');
    process.exit(0);
  })
  .catch((error) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log('❌ MongoDB Connection Failed!');
    console.log('');
    console.log('Error Details:');
    console.log(`  - Type: ${error.name}`);
    console.log(`  - Message: ${error.message}`);
    console.log(`  - Time Elapsed: ${elapsed}s`);
    console.log('');
    console.log('Common Solutions:');
    console.log('');
    console.log('1. Check MongoDB Atlas IP Whitelist:');
    console.log('   - Go to: https://cloud.mongodb.com/');
    console.log('   - Navigate to: Network Access');
    console.log('   - Add your current IP address');
    console.log('   - Or allow access from anywhere: 0.0.0.0/0');
    console.log('');
    console.log('2. Check if cluster is paused:');
    console.log('   - Go to: https://cloud.mongodb.com/');
    console.log('   - Check cluster status');
    console.log('   - Resume if paused');
    console.log('');
    console.log('3. Verify credentials:');
    console.log('   - Username: v23_db_user');
    console.log('   - Password in .env file');
    console.log('   - Check special characters are URL encoded');
    console.log('');
    console.log('4. Check internet connection:');
    console.log('   - Ping google.com');
    console.log('   - Check firewall settings');
    console.log('');
    console.log('5. Try creating a new database user:');
    console.log('   - Go to Database Access in MongoDB Atlas');
    console.log('   - Create new user with readWrite permissions');
    console.log('   - Update MONGODB_URI in .env');
    console.log('');
    console.log('========================================');
    process.exit(1);
  });

// Timeout after 60 seconds
setTimeout(() => {
  console.log('');
  console.log('⏱️  Connection timeout after 60 seconds');
  console.log('');
  console.log('This usually means:');
  console.log('  1. Your IP is not whitelisted in MongoDB Atlas');
  console.log('  2. Network firewall is blocking connection');
  console.log('  3. MongoDB Atlas cluster is paused/sleeping');
  console.log('');
  process.exit(1);
}, 60000);
