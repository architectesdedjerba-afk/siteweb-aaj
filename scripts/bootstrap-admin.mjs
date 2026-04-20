import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const EMAIL = process.env.ADMIN_EMAIL || 'architectes.de.djerba@gmail.com';
const PASSWORD = process.env.ADMIN_PASSWORD || '_Aaj2026*';
const DISPLAY_NAME = process.env.ADMIN_NAME || 'Super Admin';

const appConfig = JSON.parse(readFileSync(resolve('firebase-applet-config.json'), 'utf8'));
const FIRESTORE_DB_ID = appConfig.firestoreDatabaseId;

const saPath = resolve('serviceAccount.json');
if (!existsSync(saPath)) {
  console.error('\n❌ serviceAccount.json introuvable à la racine du projet.');
  console.error('Téléchargez-le depuis : Firebase Console → Project Settings → Service Accounts → Generate new private key');
  console.error('Puis placez le fichier à :', saPath, '\n');
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore(FIRESTORE_DB_ID);

async function main() {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(EMAIL);
    console.log(`ℹ️  Utilisateur Auth existant : ${userRecord.uid}`);
    await auth.updateUser(userRecord.uid, { password: PASSWORD, displayName: DISPLAY_NAME, emailVerified: true });
    console.log('✅ Mot de passe et displayName mis à jour.');
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    userRecord = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: DISPLAY_NAME,
      emailVerified: true,
    });
    console.log(`✅ Utilisateur Auth créé : ${userRecord.uid}`);
  }

  const uid = userRecord.uid;
  const userDoc = db.collection('users').doc(uid);
  const snap = await userDoc.get();

  const profile = {
    uid,
    displayName: DISPLAY_NAME,
    email: EMAIL,
    role: 'admin',
    status: 'active',
    createdAt: snap.exists ? (snap.data().createdAt ?? Timestamp.now()) : Timestamp.now(),
  };

  await userDoc.set(profile, { merge: true });
  console.log(`✅ Profil Firestore users/${uid} : role=admin, status=active`);
  console.log(`\n🎉 Connectez-vous sur /espace-adherents avec :\n   Email : ${EMAIL}\n   Password : ${PASSWORD}\n`);
}

main().catch((err) => {
  console.error('\n❌ Erreur :', err.message || err);
  process.exit(1);
});
