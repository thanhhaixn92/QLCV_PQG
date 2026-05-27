import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

import { getFirestore } from "firebase-admin/firestore";

let targetProjectId = process.env.FIREBASE_PROJECT_ID || '';
const configuredDatabaseId = process.env.FIRESTORE_DATABASE_ID || '';

const dryRun = process.env.DRY_RUN === 'true';
const applyMigration = process.env.APPLY === 'true';
const cleanupOldFields = process.env.CLEANUP_OLD_FIELDS === 'true';
const forceCleanup = process.env.FORCE_CLEANUP === 'true';
const CURRENT_MIGRATION_VERSION = 1;

if (!targetProjectId) {
  console.error('Missing FIREBASE_PROJECT_ID');
  process.exit(1);
}

const rawServiceAccountJson =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  (process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8')
    : '');

let credential: any = null;
if (rawServiceAccountJson) {
  try {
    const parsed = JSON.parse(rawServiceAccountJson);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    if (parsed.project_id && targetProjectId && parsed.project_id !== targetProjectId && parsed.project_id.startsWith(targetProjectId)) {
      console.warn(`[Firebase Admin] FIREBASE_PROJECT_ID (${targetProjectId}) appears truncated. Using full project_id from service account: ${parsed.project_id}`);
      targetProjectId = parsed.project_id;
    }
    credential = admin.credential.cert(parsed);
  } catch (e: any) {
    console.error('Failed to parse service account:', e.message);
  }
} else {
  credential = admin.credential.applicationDefault();
}

const app = admin.initializeApp({
  credential,
  projectId: targetProjectId
});

const firestore = configuredDatabaseId && configuredDatabaseId !== '(default)' 
  ? getFirestore(app, configuredDatabaseId)
  : getFirestore(app);

async function migrate() {
  console.log(`Starting migration (Dry run: ${dryRun}, Apply: ${applyMigration}, Cleanup: ${cleanupOldFields}, Force Cleanup: ${forceCleanup}) on project ${targetProjectId}, database ${configuredDatabaseId || '(default)'}`);
  
  const stats = { users: 0, sessions: 0, versionsCopied: 0, illustrationsCopied: 0, cleaned: 0, applied: 0, skipped: 0, errors: 0 };
  
  try {
    const usersSnapshot = await firestore.collection("users").get();
    stats.users = usersSnapshot.size;
    console.log(`Found ${stats.users} users`);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const sessionsSnapshot = await firestore.collection("users").doc(userId).collection("sessions").get();
      stats.sessions += sessionsSnapshot.size;

      for (const sessionDoc of sessionsSnapshot.docs) {
        const sessionId = sessionDoc.id;
        const data = sessionDoc.data();

        const hasMigrated = data.migrationVersion >= CURRENT_MIGRATION_VERSION || !!data.migratedAt;
        const hasOldVersions = Array.isArray(data.versions) && data.versions.length > 0;
        const hasOldIllustrations = Array.isArray(data.illustrations) && data.illustrations.length > 0;
        const hasOldCurrentOutput = typeof data.currentOutput === 'string' && data.currentOutput.length > 0;

        let actionTaken = false;

        if (cleanupOldFields) {
          if (!hasMigrated && !forceCleanup) {
            console.log(`    Session ${sessionId}: Skip cleanup (not migrated yet). Use FORCE_CLEANUP=true to override.`);
          } else if (hasOldVersions || hasOldIllustrations || hasOldCurrentOutput || data.versions !== undefined || data.illustrations !== undefined || data.currentOutput !== undefined) {
             console.log(`    CLEANUP Session ${sessionId}...`);
             if (!dryRun) {
               await sessionDoc.ref.update({
                 versions: admin.firestore.FieldValue.delete(),
                 illustrations: admin.firestore.FieldValue.delete(),
                 currentOutput: admin.firestore.FieldValue.delete()
               });
             }
             stats.cleaned++;
             actionTaken = true;
          }
        } else if (applyMigration) {
          if (hasMigrated) {
            console.log(`    Session ${sessionId}: Already migrated (v${data.migrationVersion || '?'}). Skip.`);
          } else if (hasOldVersions || hasOldIllustrations || hasOldCurrentOutput) {
            console.log(`    Migrating Session ${sessionId} (Versions: ${data.versions?.length || 0}, Illustrations: ${data.illustrations?.length || 0}, Output: ${hasOldCurrentOutput})...`);
            
            const batch = firestore.batch();
            
            let latestVersionId = data.latestVersionId || null;
            let latestPreview = data.latestPreview || (hasOldCurrentOutput ? data.currentOutput.slice(0, 500) : null);

            let copiedVersions = 0;
            let copiedIllustrations = 0;

            if (hasOldVersions) {
              for (const [idx, v] of data.versions.entries()) {
                const versionRef = sessionDoc.ref.collection("versions").doc();
                batch.set(versionRef, {
                  sessionId,
                  versionNumber: v.versionNumber || v.version || (idx + 1),
                  content: v.content || "",
                  note: v.note || "Migrated from legacy array",
                  prompt: v.prompt || "",
                  createdAt: v.createdAt || data.createdAt || Date.now()
                });
                copiedVersions++;
                if (idx === 0 && !latestVersionId) {
                  latestVersionId = versionRef.id;
                  latestPreview = (v.content || "").slice(0, 500);
                }
              }
            } else if (hasOldCurrentOutput && !latestVersionId) {
              const versionRef = sessionDoc.ref.collection("versions").doc();
              batch.set(versionRef, {
                sessionId,
                versionNumber: 1,
                content: data.currentOutput,
                note: "Migrated from currentOutput field",
                createdAt: data.updatedAt || Date.now()
              });
              latestVersionId = versionRef.id;
              copiedVersions++;
            }

            if (hasOldIllustrations) {
              for (const ill of data.illustrations) {
                const illRef = sessionDoc.ref.collection("illustrations").doc();
                batch.set(illRef, {
                  ...ill,
                  sessionId,
                  createdAt: ill.createdAt || data.createdAt || Date.now()
                });
                copiedIllustrations++;
              }
            }

            batch.update(sessionDoc.ref, {
               updatedAt: Date.now(),
               latestVersionId,
               latestPreview,
               migrationVersion: CURRENT_MIGRATION_VERSION,
               migratedAt: Date.now()
            });

            if (!dryRun) {
              await batch.commit();
            }
            stats.versionsCopied += copiedVersions;
            stats.illustrationsCopied += copiedIllustrations;
            stats.applied++;
            actionTaken = true;
          } else {
             // No data to migrate, but mark as migrated so we don't look at it again
             console.log(`    Marking Session ${sessionId} as migrated (empty data)...`);
             if (!dryRun) {
                await sessionDoc.ref.update({
                  migrationVersion: CURRENT_MIGRATION_VERSION,
                  migratedAt: Date.now()
                });
             }
             stats.applied++;
             actionTaken = true;
          }
        }
        
        if (!actionTaken) {
          stats.skipped++;
        }
      }
    }
  } catch (err) {
    stats.errors++;
    throw err;
  } finally {
    console.log("Migration complete.");
    console.log("Stats:", JSON.stringify(stats, null, 2));
  }
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
