import { getToken, onMessage } from 'firebase/messaging';
import { messaging, db, auth } from '../firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

// Note: You need to generate a VAPID key in the Firebase Console:
// Project Settings -> Cloud Messaging -> Web configuration -> Web Push certificates
const VAPID_KEY = "BD_YOUR_VAPID_KEY_HERE"; 

export const requestNotificationPermission = async () => {
  if (!messaging || typeof window === 'undefined') return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Register service worker if not already registered
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration
        });
        
        if (token && auth.currentUser) {
          // Save token to user profile
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(token)
          });
          console.log('FCM Token registered:', token);
          return token;
        }
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) return;
  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
};
