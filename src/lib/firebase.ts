import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const firebaseApp = initializeApp(firebaseConfig);

// Safe database initialization
let firestoreDb: any;
try {
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  if (dbId && dbId !== '(default)') {
    firestoreDb = getFirestore(firebaseApp, dbId);
  } else {
    firestoreDb = getFirestore(firebaseApp);
  }
} catch (e) {
  console.error("Firestore initialization failed, falling back to default:", e);
  firestoreDb = getFirestore(firebaseApp);
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

console.log('Firebase Services Initialized:', { 
  projectId: firebaseConfig.projectId, 
  hasDb: !!db,
  dbType: typeof db
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
    } else if (error.message && error.message.includes('the client is offline')) {
      console.error("Firestore Client: Error - The client is offline. Please check your network and configuration.");
    } else {
        console.error("Firestore Client: Connection test failed with error:", error);
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}
