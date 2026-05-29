import { 
  collection, 
  doc, 
  setDoc,
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  Firestore
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { ProjectSession, ArticleVersion, SessionIllustration } from "../types";

export class SessionService {
  private static getSessionRef(userId: string, sessionId: string) {
    return doc(db, "users", userId, "sessions", sessionId);
  }

  private static getVersionsRef(userId: string, sessionId: string) {
    return collection(db, "users", userId, "sessions", sessionId, "versions");
  }

  private static getIllustrationsRef(userId: string, sessionId: string) {
    return collection(db, "users", userId, "sessions", sessionId, "illustrations");
  }

  static async createSession(userId: string, sessionData: Omit<ProjectSession, 'id'>, initialVersions: ArticleVersion[] = []): Promise<string> {
    const colRef = collection(db, "users", userId, "sessions");
    // Ensure we don't save large nested data in the parent document
    const { versions, illustrations, currentOutput, ...safeSessionMetadata } = sessionData as any;
    
    const docRef = await addDoc(colRef, {
      ...safeSessionMetadata,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    // Add initial versions if any
    for (const v of initialVersions) {
      await this.saveVersion(userId, docRef.id, v);
    }
    
    return docRef.id;
  }

  static async updateSession(userId: string, sessionId: string, sessionData: Partial<ProjectSession>) {
    const sessionRef = this.getSessionRef(userId, sessionId);
    const { versions, illustrations, currentOutput, ...safeUpdateData } = sessionData as any;
    await updateDoc(sessionRef, {
      ...safeUpdateData,
      updatedAt: Date.now()
    });
  }

  static async saveVersion(userId: string, sessionId: string, version: ArticleVersion): Promise<string> {
    const colRef = this.getVersionsRef(userId, sessionId);
    const { id, ...data } = version;
    
    let versionId = id;
    
    if (versionId) {
      // Use existing ID if provided
      const docRef = doc(colRef, versionId);
      await setDoc(docRef, {
        ...data,
        sessionId,
        updatedAt: Date.now()
      }, { merge: true });
    } else {
      // Generate new ID
      const docRef = await addDoc(colRef, {
        ...data,
        sessionId,
        createdAt: Date.now()
      });
      versionId = docRef.id;
    }

    // Update session metadata
    await this.updateSession(userId, sessionId, {
      latestVersionId: versionId,
      latestPreview: version.content ? version.content.slice(0, 500) : '',
    });

    return versionId;
  }

  static async getVersions(userId: string, sessionId: string): Promise<ArticleVersion[]> {
    const colRef = this.getVersionsRef(userId, sessionId);
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ArticleVersion));
  }

  static async addIllustration(userId: string, sessionId: string, illustration: Omit<SessionIllustration, 'id' | 'createdAt'>): Promise<string> {
    const colRef = this.getIllustrationsRef(userId, sessionId);
    const docRef = await addDoc(colRef, {
      ...illustration,
      createdAt: Date.now()
    });
    return docRef.id;
  }

  static async getIllustrations(userId: string, sessionId: string): Promise<SessionIllustration[]> {
    const colRef = this.getIllustrationsRef(userId, sessionId);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SessionIllustration));
  }
}

