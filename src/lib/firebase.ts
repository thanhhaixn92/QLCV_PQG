import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Requirement 1: Use VITE_ environment variables
let projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
if (projectId === 'gen-lang-client-073317000') {
  projectId = 'gen-lang-client-0733170002';
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || '';
if (firestoreDatabaseId && firestoreDatabaseId.startsWith('ai-studio-b6074ed0')) {
  firestoreDatabaseId = 'ai-studio-b6074ed0-9102-4183-836c-45db24476dce';
}

// Validation check
const missingKeys = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0 && typeof window !== 'undefined') {
  console.error("Missing Firebase Configuration keys:", missingKeys);
  // We throw a delayed error or handle it in the UI
}

const firebaseApp = initializeApp(firebaseConfig);

// Safe database initialization
let firestoreDb: any;
try {
  const dbId = firestoreDatabaseId;
  if (dbId && dbId !== '(default)') {
    firestoreDb = initializeFirestore(firebaseApp, { 
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true
    }, dbId);
  } else {
    firestoreDb = initializeFirestore(firebaseApp, { 
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true
    });
  }
} catch (e) {
  console.error("Firestore initialization failed. No fallback allowed for named database:", e);
  throw e;
}

export const db = firestoreDb;

export const auth = initializeAuth(firebaseApp, {
  persistence: [browserLocalPersistence, browserSessionPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
});

export const storage = getStorage(firebaseApp);

console.info("[Firebase Config]", {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  firestoreDatabaseId: firestoreDatabaseId
});

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
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
        userId: currentUser?.uid || 'no-uid',
        email: currentUser?.email || 'no-email',
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
