import { MongoClient, type Db } from "mongodb";

declare global {
  var __babyNameMongoClient: MongoClient | undefined;
  var __babyNameMongoSetup: Promise<void> | undefined;
}

function databaseName() {
  return process.env.MONGODB_DATABASE?.trim() || "baby_name_guess";
}

export async function getDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI. Add it to the Vercel environment variables.");

  const client = globalThis.__babyNameMongoClient ?? new MongoClient(uri);
  globalThis.__babyNameMongoClient = client;
  await client.connect();
  const db = client.db(databaseName());

  globalThis.__babyNameMongoSetup ??= Promise.all([
    db.collection("guessEntries").createIndex(
      { mobile: 1 },
      {
        unique: true,
        name: "unique_adult_mobile",
        partialFilterExpression: { entryType: "adult", mobile: { $type: "string" } },
      },
    ),
    db
      .collection("guessNames")
      .createIndex({ nameKey: 1 }, { unique: true, name: "unique_managed_name" }),
    db.collection("guessEntries").createIndex({ createdAt: -1 }),
  ]).then(() => undefined);
  await globalThis.__babyNameMongoSetup;

  await db
    .collection("eventState")
    .updateOne(
      { _id: "singleton" },
      { $setOnInsert: { babyName: null, revealed: false, winnerId: null, updatedAt: new Date() } },
      { upsert: true },
    );
  return db;
}
