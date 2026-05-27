import { collection, doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { ActivityLogEntry } from '../types';

export async function logActivity(entry: Omit<ActivityLogEntry, "id" | "createdAt" | "userId">): Promise<void> {
  try {
    const user = auth?.currentUser;
    if (!user || !db) return;

    const logId = doc(collection(db, 'users', user.uid, 'activityLogs')).id;
    
    // Truncate fields for safety
    const title = entry.title.substring(0, 160);
    const summary = entry.summary.substring(0, 500);
    
    const fullEntry: ActivityLogEntry = {
      ...entry,
      id: logId,
      userId: user.uid,
      title,
      summary,
      actor: entry.actor || {
        uid: user.uid,
        displayName: user.displayName || '',
        email: user.email || ''
      },
      createdAt: Date.now()
    };
    
    // Safety check on metadata
    if (fullEntry.metadata?.errorMessage) {
        fullEntry.metadata.errorMessage = fullEntry.metadata.errorMessage.substring(0, 500);
    }

    await setDoc(doc(db, 'users', user.uid, 'activityLogs', logId), fullEntry);
  } catch (error) {
    console.warn("Failed to log activity:", error);
  }
}
