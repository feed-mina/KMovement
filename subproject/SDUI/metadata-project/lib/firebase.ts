import {
  initializeApp,
  getApps,
  getApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const fallbackFirebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyB3P8KTUQ6CTziP0cmnyH64TCcD4N-rLI8",
  authDomain: "krider-8186e.firebaseapp.com",
  projectId: "krider-8186e",
  storageBucket: "krider-8186e.firebasestorage.app",
  messagingSenderId: "455700419792",
  appId: "1:455700419792:web:42d756588879e5133abad5",
};

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || fallbackFirebaseConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || fallbackFirebaseConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || fallbackFirebaseConfig.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || fallbackFirebaseConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    fallbackFirebaseConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || fallbackFirebaseConfig.appId,
};

const requiredConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "messagingSenderId",
  "appId",
] as const;

const missingConfigKeys = requiredConfigKeys.filter((key) => !firebaseConfig[key]);

const getFirebaseApp = (): FirebaseApp | null => {
  if (missingConfigKeys.length > 0) {
    console.warn(
      `Firebase messaging disabled. Missing config values: ${missingConfigKeys.join(", ")}`
    );
    return null;
  }

  return !getApps().length ? initializeApp(firebaseConfig) : getApp();
};

const app = getFirebaseApp();

const hasNotificationPermission = async () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (window.Notification.permission === "denied") {
    return false;
  }

  if (window.Notification.permission === "default") {
    return (await window.Notification.requestPermission()) === "granted";
  }

  return true;
};

const isPermissionError = (error: unknown) => {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = String((error as { code?: unknown }).code);
  return code === "messaging/permission-blocked" || code === "messaging/permission-default";
};

export const requestForToken = async () => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("This browser does not support Firebase messaging.");
      return null;
    }

    if (!app) {
      return null;
    }

    if (!(await hasNotificationPermission())) {
      return null;
    }

    const messaging = getMessaging(app);
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const currentToken = await getToken(messaging, {
      ...(vapidKey ? { vapidKey } : {}),
    });

    if (currentToken) {
      console.log("Current FCM token: ", currentToken);
      return currentToken;
    }

    console.log("No registration token available. Permission may be denied.");
    return null;
  } catch (err) {
    if (isPermissionError(err)) return null;
    console.warn("Firebase messaging token is temporarily unavailable: ", err);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve, reject) => {
    isSupported()
      .then((supported: boolean) => {
        if (!supported) {
          reject(new Error("This browser does not support Firebase messaging."));
          return;
        }

        if (!app) {
          reject(new Error("Firebase messaging is not configured."));
          return;
        }

        const messaging = getMessaging(app);
        onMessage(messaging, resolve);
      })
      .catch(reject);
  });

export { app };
