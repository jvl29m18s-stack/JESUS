importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: "gen-lang-client-0275565713",
  appId: "1:796388963555:web:8ddfd7eb8e23d80db601d6",
  apiKey: "AIzaSyD-8HrMeOasBg2lltbMQtXV4Ek-deAWxIc",
  authDomain: "gen-lang-client-0275565713.firebaseapp.com",
  storageBucket: "gen-lang-client-0275565713.firebasestorage.app",
  messagingSenderId: "796388963555"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
