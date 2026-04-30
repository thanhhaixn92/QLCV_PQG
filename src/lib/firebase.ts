import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const firebaseApp = initializeApp(firebaseConfig);

// Safe database initialization
let firestoreDb: any;
try {
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  if (dbId && dbId !== '(default)') {
    firestoreDb = initializeFirestore(firebaseApp, {}, dbId);
  } else {
    firestoreDb = getFirestore(firebaseApp);
  }
} catch (e) {
  console.error("Firestore initialization failed. No fallback allowed for named database:", e);
  throw e; // Do not fallback to (default)
}

export const db = firestoreDb;
export const auth = getAuth(firebaseApp);

// Fix for "INTERNAL ASSERTION FAILED: Pending promise was never set"
// This usually occurs when browserIndexedDbPersistence (default) fails in certain environments.
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("Firebase Auth persistence failed:", err);
  });
}
export const storage = getStorage(firebaseApp);

console.info("[Firebase Config]", {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  firestoreDatabaseId: (firebaseConfig as any).firestoreDatabaseId
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
      console.error("Firestore Client: Connection error. This often means the Firestore Database in your Firebase Project is not provisioned or configured correctly. Please visit the Firebase Console and ensure a Firestore Database exists (select '(default)' database).");
    } else {
        console.error("Firestore Client: Connection test failed with error:", error);
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}
