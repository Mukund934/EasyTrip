require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getStorage } = require('firebase/storage');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK for authentication
let adminApp;
try {
  if (!admin.apps.length) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    adminApp = admin.apps[0];
  }
} catch (error) {
  console.error('❌ Firebase Admin SDK initialization error:', error.message);
}

// Initialize Firebase Client SDK for storage
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('Firebase Storage Bucket:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

// Initialize Firebase app
const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

console.log('Firebase initialized with app:', !!firebaseApp);

module.exports = {
  admin,
  firebaseApp,
  storage
};