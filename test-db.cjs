const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const targetProjectId = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0733170002';
const normalizedDatabaseId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-b6074ed0-9102-4183-836c-45db24476dce';

const rawServiceAccountJson =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  (process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8')
    : '');

let credential;
if (rawServiceAccountJson) {
    try {
        const parsed = JSON.parse(rawServiceAccountJson);
        if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        credential = admin.credential.cert(parsed);
        console.log("Using Service Account JSON");
    } catch (e) {
        console.error("Invalid Service Account JSON:", e.message);
        process.exit(1);
    }
} else {
    credential = admin.credential.applicationDefault();
    console.log("Using Application Default Credentials");
}

admin.initializeApp({
  credential,
  projectId: targetProjectId
});

async function run() {
  console.log(`Testing Project: ${targetProjectId}, Database: ${normalizedDatabaseId}`);
  try {
    const db = getFirestore(admin.app(), normalizedDatabaseId);
    const snapshot = await db.collection('_health').limit(1).get();
    console.log("Named DB Connection Success! Health check ok.");
  } catch (e) {
    console.error("Named DB Connection Error:", e.message);
    if (e.code === 5 || e.message.includes('NOT_FOUND')) {
        console.error("Hint: Database ID might be wrong or not created yet.");
    }
    process.exit(1);
  }
}
run();
