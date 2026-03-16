import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline')) {
        console.error("Firestore connection failed: The client is offline. Please check your Firebase configuration and internet connection.");
      } else if (error.message.includes('insufficient permissions')) {
        // This is actually a good sign! It means we reached the server but are not yet authenticated.
        console.log("Firestore reachability confirmed (Auth required for full access)");
      } else {
        console.error("Firestore connection error:", error);
      }
    }
  }
}

testConnection();
