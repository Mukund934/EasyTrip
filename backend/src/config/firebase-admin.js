const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized
let firebaseAdmin;

try {
  firebaseAdmin = admin.app();
} catch (error) {
  // If using environment variables
  if (process.env.FIREBASE_PRIVATE_KEY) {
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines in the private key
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // If using a service account file
    const serviceAccount = require('./firebase-service-account.json');
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  }
}

module.exports = { admin, firebaseAdmin };