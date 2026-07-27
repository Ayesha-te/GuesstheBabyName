import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { duplicateGuessMessage, normalizeMobile } from "./guessing.helpers";

const nameId = z.string().uuid("Choose a name from the list");
const guessSchema = z.discriminatedUnion("entryType", [
  z.object({
    entryType: z.literal("adult"),
    guestName: z.string().trim().min(2).max(80),
    mobile: z.string().trim().min(1),
    guessNameId: nameId,
  }),
  z.object({
    entryType: z.literal("kid"),
    guestName: z.string().trim().min(2).max(80),
    guardianName: z.string().trim().max(80).optional(),
    guessNameId: nameId,
  }),
]);
const passcodeSchema = z.object({ passcode: z.string().min(1).max(200) });
const deleteEntriesSchema = passcodeSchema.extend({
  ids: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
});
const nameMutationSchema = passcodeSchema.extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(60).optional(),
  isActive: z.boolean().optional(),
});

type EntryDocument = {
  _id: string;
  guestName: string;
  entryType: "adult" | "kid";
  email: string | null;
  mobile: string | null;
  guardianName: string | null;
  guessNameId: string;
  guessName: string;
  guessKey: string;
  createdAt: Date;
};
type NameDocument = {
  _id: string;
  name: string;
  nameKey: string;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type EventDocument = {
  _id: string;
  babyName: string | null;
  revealed: boolean;
  winnerId: string | null;
  updatedAt: Date;
};

export type ManagedName = {
  id: string;
  name: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
};
export type PublicBoard = {
  total: number;
  guesses: { name: string; count: number }[];
  names: { id: string; name: string }[];
  revealed: boolean;
  babyName: string | null;
  winner: { guestName: string; guessName: string } | null;
  namesReady: boolean;
};
export type HostEntry = {
  id: string;
  guestName: string;
  entryType: "adult" | "kid";
  email: string | null;
  mobile: string | null;
  guardianName: string | null;
  guessName: string;
  createdAt: string;
};
export type HostData = {
  entries: HostEntry[];
  names: ManagedName[];
  babyName: string | null;
  revealed: boolean;
  winnerId: string | null;
  namesReady: boolean;
};

function maskName(full: string) {
  const parts = full.trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts.at(-1)![0].toUpperCase()}.`;
}

function assertHost(passcode: string) {
  if (!process.env.HOST_PASSCODE || passcode !== process.env.HOST_PASSCODE) {
    throw new Error("Incorrect host passcode");
  }
}

function nameKey(name: string) {
  return name.trim().toLocaleLowerCase();
}

function isDuplicateKey(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

async function collections() {
  const { getDatabase } = await import("./mongodb.server");
  const db = await getDatabase();
  return {
    entries: db.collection<EntryDocument>("guessEntries"),
    names: db.collection<NameDocument>("guessNames"),
    state: db.collection<EventDocument>("eventState"),
  };
}

export const getPublicBoard = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicBoard> => {
    const { entries, names, state } = await collections();
    const [rows, availableNames, event] = await Promise.all([
      entries.find({}).toArray(),
      names.find({ isActive: true, deletedAt: null }).sort({ name: 1 }).toArray(),
      state.findOne({ _id: "singleton" }),
    ]);
    const tally = new Map<string, { name: string; count: number }>();
    for (const row of rows) {
      const current = tally.get(row.guessKey);
      if (current) current.count += 1;
      else tally.set(row.guessKey, { name: row.guessName, count: 1 });
    }
    const winner = event?.winnerId ? rows.find((row) => row._id === event.winnerId) : undefined;
    return {
      total: rows.length,
      guesses: [...tally.values()].sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name),
      ),
      names: availableNames.map((name) => ({ id: name._id, name: name.name })),
      revealed: Boolean(event?.revealed),
      babyName: event?.revealed ? (event.babyName ?? null) : null,
      winner: winner
        ? { guestName: maskName(winner.guestName), guessName: winner.guessName }
        : null,
      namesReady: true,
    };
  },
);

export const submitGuess = createServerFn({ method: "POST" })
  .validator((data: unknown) => guessSchema.parse(data))
  .handler(async ({ data }) => {
    const { entries, names, state } = await collections();
    const [event, selected] = await Promise.all([
      state.findOne({ _id: "singleton" }),
      names.findOne({ _id: data.guessNameId, isActive: true, deletedAt: null }),
    ]);
    if (event?.revealed) {
      return { ok: false, error: "Guessing is closed — the name has already been revealed." };
    }
    if (!selected) {
      return { ok: false, error: "That name is no longer available. Please choose another." };
    }
    const mobile = data.entryType === "adult" ? normalizeMobile(data.mobile) : null;
    if (data.entryType === "adult" && !mobile) {
      return { ok: false, error: "Enter a valid mobile number with 7–15 digits." };
    }
    try {
      await entries.insertOne({
        _id: randomUUID(),
        guestName: data.guestName,
        entryType: data.entryType,
        email: null,
        mobile,
        guardianName: data.entryType === "kid" ? data.guardianName || null : null,
        guessNameId: selected._id,
        guessName: selected.name,
        guessKey: nameKey(selected.name),
        createdAt: new Date(),
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        return { ok: false, error: duplicateGuessMessage(data.entryType) };
      }
      console.error("MongoDB guess insert failed", error);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
    return { ok: true };
  });

async function loadHostData(): Promise<HostData> {
  const { entries, names, state } = await collections();
  const [rows, managedNames, event] = await Promise.all([
    entries.find({}).sort({ createdAt: -1 }).toArray(),
    names.find({}).sort({ name: 1 }).toArray(),
    state.findOne({ _id: "singleton" }),
  ]);
  return {
    entries: rows.map((entry) => ({
      id: entry._id,
      guestName: entry.guestName,
      entryType: entry.entryType,
      email: entry.email ?? null,
      mobile: entry.mobile ?? null,
      guardianName: entry.guardianName ?? null,
      guessName: entry.guessName,
      createdAt: entry.createdAt.toISOString(),
    })),
    names: managedNames.map((name) => ({
      id: name._id,
      name: name.name,
      isActive: name.isActive,
      deletedAt: name.deletedAt?.toISOString() ?? null,
      createdAt: name.createdAt.toISOString(),
    })),
    babyName: event?.babyName ?? null,
    revealed: Boolean(event?.revealed),
    winnerId: event?.winnerId ?? null,
    namesReady: true,
  };
}

export const hostLoad = createServerFn({ method: "POST" })
  .validator((data: unknown) => passcodeSchema.parse(data))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    return loadHostData();
  });

export const hostSetBabyName = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    passcodeSchema.extend({ babyName: z.string().trim().min(1).max(60) }).parse(data),
  )
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    const { state } = await collections();
    await state.updateOne(
      { _id: "singleton" },
      { $set: { babyName: data.babyName, revealed: true, updatedAt: new Date() } },
    );
    return loadHostData();
  });

export const hostReset = createServerFn({ method: "POST" })
  .validator((data: unknown) => passcodeSchema.parse(data))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    const { state } = await collections();
    await state.updateOne(
      { _id: "singleton" },
      { $set: { revealed: false, winnerId: null, updatedAt: new Date() } },
    );
    return loadHostData();
  });

export const hostDrawWinner = createServerFn({ method: "POST" })
  .validator((data: unknown) => passcodeSchema.parse(data))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    const { entries, state } = await collections();
    const event = await state.findOne({ _id: "singleton" });
    const key = event?.babyName ? nameKey(event.babyName) : null;
    if (!key) throw new Error("Set the baby's name first");
    const correct = await entries.find({ guessKey: key }, { projection: { _id: 1 } }).toArray();
    const winnerId = correct.length
      ? correct[Math.floor(Math.random() * correct.length)]._id
      : null;
    await state.updateOne({ _id: "singleton" }, { $set: { winnerId, updatedAt: new Date() } });
    return loadHostData();
  });

export const hostDeleteEntries = createServerFn({ method: "POST" })
  .validator((data: unknown) => deleteEntriesSchema.parse(data))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    const ids = data.ids ?? [];
    if (!data.all && !ids.length) throw new Error("Select at least one entry to remove");
    const { entries, state } = await collections();
    await state.updateOne({ _id: "singleton" }, { $set: { winnerId: null } });
    if (data.all) await entries.deleteMany({});
    else await entries.deleteMany({ _id: { $in: ids } });
    return loadHostData();
  });

export const hostSaveName = createServerFn({ method: "POST" })
  .validator((data: unknown) => nameMutationSchema.parse(data))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    if (!data.name) throw new Error("Enter a name");
    const { names } = await collections();
    const now = new Date();
    try {
      if (data.id) {
        await names.updateOne(
          { _id: data.id },
          {
            $set: {
              name: data.name,
              nameKey: nameKey(data.name),
              isActive: data.isActive ?? true,
              deletedAt: null,
              updatedAt: now,
            },
          },
        );
      } else {
        await names.insertOne({
          _id: randomUUID(),
          name: data.name,
          nameKey: nameKey(data.name),
          isActive: data.isActive ?? true,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      if (isDuplicateKey(error)) throw new Error("That name already exists");
      throw new Error("Could not save the name");
    }
    return loadHostData();
  });

export const hostSetNameActive = createServerFn({ method: "POST" })
  .validator((data: unknown) => nameMutationSchema.parse(data))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    if (!data.id || data.isActive === undefined) throw new Error("Invalid name update");
    const { names } = await collections();
    await names.updateOne(
      { _id: data.id, deletedAt: null },
      { $set: { isActive: data.isActive, updatedAt: new Date() } },
    );
    return loadHostData();
  });

export const hostArchiveName = createServerFn({ method: "POST" })
  .validator((data: unknown) => nameMutationSchema.parse(data))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    if (!data.id) throw new Error("Invalid name");
    const { names } = await collections();
    const now = new Date();
    await names.updateOne(
      { _id: data.id },
      { $set: { isActive: false, deletedAt: now, updatedAt: now } },
    );
    return loadHostData();
  });
