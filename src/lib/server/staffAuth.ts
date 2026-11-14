import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { isStaffRole, type Role } from "@/lib/admin";

/**
 * Server side: who's calling an admin route. The browser sends the signed-in
 * user's Firebase ID token (`Authorization: Bearer …`); it's verified with
 * the Admin SDK — which needs only the project id for that, no service
 * account — and their role read from `roles/{uid}` through Firestore's REST
 * API *as them* (firestore.rules let everyone read their own role).
 */
function adminAuth() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const app = getApps()[0] ?? initializeApp({ projectId });
  return getAuth(app);
}

/** The caller's uid when they're staff — otherwise the error Response to send back. */
export async function requireStaff(request: Request): Promise<{ uid: string } | Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return Response.json({ error: "Sign in first." }, { status: 401 });
  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return Response.json({ error: "Your session expired — sign in again." }, { status: 401 });
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/roles/${uid}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  const role = response.ok
    ? ((await response.json()) as { fields?: { role?: { stringValue?: string } } }).fields?.role
        ?.stringValue
    : undefined;
  if (!role || !isStaffRole(role as Role)) {
    return Response.json({ error: "Only moderators and admins can do this." }, { status: 403 });
  }
  return { uid };
}
