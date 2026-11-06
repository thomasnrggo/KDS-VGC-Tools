/**
 * Sets someone's role from the command line — for the first admin (the app's
 * /admin/users needs an admin to already exist) or to recover access:
 *
 *   npm run set-role -- name@gmail.com admin
 *   npm run set-role -- name@gmail.com moderator
 *   npm run set-role -- name@gmail.com user      # removes their role
 *
 * Needs the same service account as the meta job: FIREBASE_SERVICE_ACCOUNT
 * (the key's JSON) or GOOGLE_APPLICATION_CREDENTIALS (a path to it). The
 * account must have signed in to the app once. Writes `roles/{uid}` as
 * /admin/users does (see src/lib/firebase/roles.ts); the Admin SDK isn't
 * bound by firestore.rules.
 */
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const ROLES = ["admin", "moderator", "user"];

const [email, role] = process.argv.slice(2);
if (!email || !ROLES.includes(role)) {
  console.error("Usage: npm run set-role -- <email> <admin|moderator|user>");
  process.exit(1);
}

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
initializeApp({
  credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(),
});

if (!serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    "No credentials: set FIREBASE_SERVICE_ACCOUNT to the service account key's JSON, or\n" +
      "GOOGLE_APPLICATION_CREDENTIALS to the key file's path (Firebase console → Project settings →\n" +
      "Service accounts → Generate new private key).",
  );
  process.exit(1);
}

/**
 * The account with this email — on the account itself, or (when the project
 * allows several accounts per email) only on its Google sign-in, which
 * getUserByEmail doesn't search.
 */
async function findUser(address) {
  const auth = getAuth();
  try {
    return await auth.getUserByEmail(address);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
  const wanted = address.toLowerCase();
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    const match = page.users.find((candidate) =>
      candidate.providerData.some((provider) => provider.email?.toLowerCase() === wanted),
    );
    if (match) return match;
    pageToken = page.pageToken;
  } while (pageToken);
  return undefined;
}

let user;
try {
  user = await findUser(email);
} catch (error) {
  console.error(`Couldn't look up ${email}: ${error?.message ?? error}`);
  process.exit(1);
}
if (!user) {
  console.error(`No account with the email ${email} — sign in to the app with it first.`);
  process.exit(1);
}

const doc = getFirestore().collection("roles").doc(user.uid);
if (role === "user") {
  await doc.delete();
  console.log(`${email} is a regular user.`);
} else {
  await doc.set({
    uid: user.uid,
    role,
    email: user.email ?? email,
    ...(user.displayName && { displayName: user.displayName }),
    setBy: "set-role script",
    setAt: new Date().toISOString(),
  });
  console.log(`${email} (${user.uid}) is now ${role}.`);
}
