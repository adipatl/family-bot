import admin from "firebase-admin";
import fs from "fs";
import { config } from "../config/index.js";
import { createLogger } from "../logger.js";

const log = createLogger("firestore");

let db: admin.firestore.Firestore;

function getDb(): admin.firestore.Firestore {
  if (!db) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(config.firebase.serviceAccountKeyPath, "utf-8"),
    );
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.firebase.projectId,
      });
    }
    db = admin.firestore();
  }
  return db;
}

// --- Notes ---

export interface Note {
  id?: string;
  text: string;
  userId: string;
  userName: string;
  groupId: string;
  createdAt: admin.firestore.Timestamp;
}

export async function addNote(
  text: string,
  userId: string,
  userName: string,
  groupId: string,
): Promise<string> {
  const ref = await getDb().collection("notes").add({
    text,
    userId,
    userName,
    groupId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  log.debug({ noteId: ref.id }, "Note created");
  return ref.id;
}

export async function listNotes(groupId: string, limit = 10): Promise<Note[]> {
  const snap = await getDb()
    .collection("notes")
    .where("groupId", "==", groupId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Note);
}

export async function deleteNote(noteId: string): Promise<void> {
  await getDb().collection("notes").doc(noteId).delete();
}

// --- Reminders ---

export interface Reminder {
  id?: string;
  message: string;
  userId: string;
  userName: string;
  groupId: string;
  dueAt: admin.firestore.Timestamp;
  notified: boolean;
  createdAt: admin.firestore.Timestamp;
}

export async function addReminder(
  message: string,
  dueAt: Date,
  userId: string,
  userName: string,
  groupId: string,
): Promise<string> {
  const ref = await getDb().collection("reminders").add({
    message,
    dueAt: admin.firestore.Timestamp.fromDate(dueAt),
    userId,
    userName,
    groupId,
    notified: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  log.debug({ reminderId: ref.id }, "Reminder created");
  return ref.id;
}

export async function listReminders(groupId: string): Promise<Reminder[]> {
  const snap = await getDb()
    .collection("reminders")
    .where("groupId", "==", groupId)
    .where("notified", "==", false)
    .orderBy("dueAt", "asc")
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Reminder);
}

export async function getDueReminders(): Promise<Reminder[]> {
  const now = admin.firestore.Timestamp.now();
  const snap = await getDb()
    .collection("reminders")
    .where("notified", "==", false)
    .where("dueAt", "<=", now)
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Reminder);
}

export async function markReminderNotified(reminderId: string): Promise<void> {
  await getDb()
    .collection("reminders")
    .doc(reminderId)
    .update({ notified: true });
}
