import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Requirement 1: Use VITE_ environment variables
let projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '';
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '';

if (projectId && projectId.length === 30) {
  // Try to repair truncated projectId from authDomain or storageBucket
  if (authDomain && authDomain.startsWith(projectId)) {
    projectId = authDomain.split('.firebaseapp.com')[0];
  } else if (storageBucket && storageBucket.startsWith(projectId)) {
    projectId = storageBucket.split('.firebasestorage.app')[0];
  }
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: authDomain,
  projectId: projectId,
  storageBucket: storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || '';

// Validation check
const isConfigured = !!firebaseConfig.projectId && !!firebaseConfig.apiKey;

let firebaseApp: any = null;
let firestoreDb: any = null;
let authInstance: any = { currentUser: null, onAuthStateChanged: (cb: any) => () => {} };
let storageInstance: any = null;

if (isConfigured) {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    
    authInstance = initializeAuth(firebaseApp, {
      persistence: [browserLocalPersistence, browserSessionPersistence],
      popupRedirectResolver: browserPopupRedirectResolver
    });
    
    storageInstance = getStorage(firebaseApp);

    const dbId = firestoreDatabaseId;
    if (dbId && dbId !== '(default)') {
      firestoreDb = initializeFirestore(firebaseApp, { 
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true
      }, dbId);
    } else if (dbId === '(default)') {
      firestoreDb = initializeFirestore(firebaseApp, { 
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true
      });
    } else {
      console.warn("FIRESTORE_DATABASE_ID is missing. Firestore is not initialized.");
    }
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
} else {
  console.warn("Firebase configuration is missing. App is running in degraded mode.");
}

export const db = firestoreDb;
export const auth = authInstance;
export const storage = storageInstance;

console.info("[Firebase Config]", {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  firestoreDatabaseId: firestoreDatabaseId,
  isConfigured
});

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string | null;
    email: string | null;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null) {
  if (error.code === 'permission-denied') {
    const currentUser = auth.currentUser;
    const errorInfo: FirestoreErrorInfo = {
      error: error.message,
      operationType,
      path,
      authInfo: {
        userId: currentUser?.uid || null,
        email: currentUser?.email || null,
        emailVerified: currentUser?.emailVerified || false,
        isAnonymous: currentUser?.isAnonymous || false,
        providerInfo: currentUser?.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || ''
        })) || []
      }
    };
    console.error(`Firestore Permission Denied [${operationType}] at ${path}:`, errorInfo);
    throw new Error(JSON.stringify(errorInfo));
  }
  throw error;
}

// CRITICAL CONSTRAINT: Test connection on boot
async function testConnection() {
  if (!db) {
    console.warn("Firestore Client: Connection test skipped because db is not initialized.");
    return;
  }
  try {
    // Try a simple read from the dedicated test path
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore Client Connection: OK");
  } catch (error: any) {
    if (error.code === 'permission-denied') {
        console.warn("Firestore Client: Connection test returned permission-denied (Expected if not sharing public test root).");
    } else if (error.message && (error.message.includes('the client is offline') || error.message.includes('Database') || error.message.includes('not found'))) {
      console.error("Firestore Client: Connection error. Kiểm tra Firestore databaseId trong firebase-applet-config.json và FIRESTORE_DATABASE_ID trên backend.");
    } else {
        console.error("Firestore Client: Connection test failed with error:", error);
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}
