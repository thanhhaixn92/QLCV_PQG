const admin = require('firebase-admin');

async function check() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error("Missing FIREBASE_PROJECT_ID environment variable.");
    process.exit(1);
  }
  
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
  const cred = raw ? admin.credential.cert(JSON.parse(raw)) : admin.credential.applicationDefault();
  admin.initializeApp({ credential: cred, projectId });
  const db = admin.firestore();
  
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({
    credentials: raw ? JSON.parse(raw) : undefined,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const res = await client.request({
    url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases`
  });
  console.log(JSON.stringify(res.data, null, 2));
}
check().catch(console.error);

