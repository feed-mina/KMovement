// firebase-messaging-sw.js

// Firebase JS SDK
importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js");

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
// 백엔드나 설정에서 받아와야 하지만 SW에서는 환경변수 접근이 어려우므로
// 하드코딩하거나 쿼리파라미터로 주입해야 합니다.
// 여기서는 유저가 주신 설정값을 사용합니다.
const firebaseConfig = {
  apiKey: "AIzaSyB3P8KTUQ6CTziP0cmnyH64TCcD4N-rLI8",
  authDomain: "krider-8186e.firebaseapp.com",
  projectId: "krider-8186e",
  storageBucket: "krider-8186e.firebasestorage.app",
  messagingSenderId: "455700419792",
  appId: "1:455700419792:web:42d756588879e5133abad5"
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );
  
  const notificationTitle = payload.notification?.title || "새 알림";
  const notificationOptions = {
    body: payload.notification?.body,
    icon: payload.notification?.image || "/icons/icon-192x192.png",
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
