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

function isManagedNamesSchemaMissing(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
    (["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code ?? "") ||
      /guess_names|entry_type|guardian_name|guess_name_id|mobile/i.test(error.message ?? "")),
  );
}

function maskName(full: string) {
  const p = full.trim().split(/\s+/);
  return p.length === 1 ? p[0] : `${p[0]} ${p.at(-1)![0].toUpperCase()}.`;
}
function assertHost(passcode: string) {
  if (!process.env.HOST_PASSCODE || passcode !== process.env.HOST_PASSCODE)
    throw new Error("Incorrect host passcode");
}

export const getPublicBoard = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicBoard> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rows, error }, { data: state }, { data: names, error: namesError }] =
      await Promise.all([
        supabaseAdmin.from("guesses").select("id, guest_name, guess_name, guess_key"),
        supabaseAdmin.from("event_state").select("*").eq("id", 1).maybeSingle(),
        supabaseAdmin
          .from("guess_names")
          .select("id, name")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name"),
      ]);
    if (error) throw new Error("Could not load guesses");
    const tally = new Map<string, { name: string; count: number }>();
    for (const row of rows ?? []) {
      const key = row.guess_key ?? row.guess_name.trim().toLowerCase();
      const old = tally.get(key);
      if (old) old.count += 1;
      else tally.set(key, { name: row.guess_name.trim(), count: 1 });
    }
    const winner = state?.winner_id
      ? (rows ?? []).find((r) => r.id === state.winner_id)
      : undefined;
    return {
      total: rows?.length ?? 0,
      guesses: [...tally.values()].sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name),
      ),
      names: names ?? [],
      revealed: Boolean(state?.revealed),
      babyName: state?.revealed ? state.baby_name : null,
      winner: winner
        ? { guestName: maskName(winner.guest_name), guessName: winner.guess_name }
        : null,
      namesReady: !namesError,
    };
  },
);

export const submitGuess = createServerFn({ method: "POST" })
  .validator((d: unknown) => guessSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: state }, { data: selected }] = await Promise.all([
      supabaseAdmin.from("event_state").select("revealed").eq("id", 1).maybeSingle(),
      supabaseAdmin
        .from("guess_names")
        .select("id, name")
        .eq("id", data.guessNameId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle(),
    ]);
    if (state?.revealed)
      return { ok: false, error: "Guessing is closed — the name has already been revealed." };
    if (!selected)
      return { ok: false, error: "That name is no longer available. Please choose another." };
    const mobile = data.entryType === "adult" ? normalizeMobile(data.mobile) : null;
    if (data.entryType === "adult" && !mobile)
      return { ok: false, error: "Enter a valid mobile number with 7–15 digits." };
    const { error } = await supabaseAdmin.from("guesses").insert({
      guest_name: data.guestName,
      entry_type: data.entryType,
      mobile,
      guardian_name: data.entryType === "kid" ? data.guardianName || null : null,
      email: null,
      guess_name_id: selected.id,
      guess_name: selected.name,
    });
    if (error?.code === "23505") return { ok: false, error: duplicateGuessMessage(data.entryType) };
    if (error) return { ok: false, error: "Something went wrong. Please try again." };
    return { ok: true };
  });

async function loadHostData(): Promise<HostData> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [entriesResult, stateResult, namesResult] = await Promise.all([
    supabaseAdmin
      .from("guesses")
      .select("id, guest_name, entry_type, email, mobile, guardian_name, guess_name, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("event_state").select("*").eq("id", 1).maybeSingle(),
    supabaseAdmin
      .from("guess_names")
      .select("id, name, is_active, deleted_at, created_at")
      .order("name"),
  ]);
  let rows = entriesResult.data;
  let legacySchema = false;
  if (entriesResult.error && isManagedNamesSchemaMissing(entriesResult.error)) {
    legacySchema = true;
    const legacy = await supabaseAdmin
      .from("guesses")
      .select("id, guest_name, email, guess_name, created_at")
      .order("created_at", { ascending: false });
    if (legacy.error) {
      console.error("Host legacy entry load failed", legacy.error);
      throw new Error("Entries could not be loaded. Check the database connection and retry.");
    }
    rows = (legacy.data ?? []).map((row) => ({
      ...row,
      entry_type: "adult",
      mobile: null,
      guardian_name: null,
    }));
  } else if (entriesResult.error) {
    console.error("Host entry load failed", entriesResult.error);
    throw new Error("Entries could not be loaded. Check the database connection and retry.");
  }
  if (stateResult.error) {
    console.error("Host event state load failed", stateResult.error);
    throw new Error("Reveal settings could not be loaded. Please retry.");
  }
  if (namesResult.error && !isManagedNamesSchemaMissing(namesResult.error)) {
    console.error("Host managed-name load failed", namesResult.error);
    throw new Error("Name choices could not be loaded. Please retry.");
  }
  const state = stateResult.data;
  const names = namesResult.data;
  return {
    entries: (rows ?? []).map((r) => ({
      id: r.id,
      guestName: r.guest_name,
      entryType: r.entry_type as "adult" | "kid",
      email: r.email,
      mobile: r.mobile,
      guardianName: r.guardian_name,
      guessName: r.guess_name,
      createdAt: r.created_at,
    })),
    names: (names ?? []).map((n) => ({
      id: n.id,
      name: n.name,
      isActive: n.is_active,
      deletedAt: n.deleted_at,
      createdAt: n.created_at,
    })),
    babyName: state?.baby_name ?? null,
    revealed: Boolean(state?.revealed),
    winnerId: state?.winner_id ?? null,
    namesReady: !legacySchema && !namesResult.error,
  };
}

export const hostLoad = createServerFn({ method: "POST" })
  .validator((d: unknown) => passcodeSchema.parse(d))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    return loadHostData();
  });
export const hostSetBabyName = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    passcodeSchema.extend({ babyName: z.string().trim().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("event_state")
      .update({ baby_name: data.babyName, revealed: true, updated_at: new Date().toISOString() })
      .eq("id", 1);
    return loadHostData();
  });
export const hostReset = createServerFn({ method: "POST" })
  .validator((d: unknown) => passcodeSchema.parse(d))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("event_state")
      .update({ revealed: false, winner_id: null, updated_at: new Date().toISOString() })
      .eq("id", 1);
    return loadHostData();
  });
export const hostDrawWinner = createServerFn({ method: "POST" })
  .validator((d: unknown) => passcodeSchema.parse(d))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("event_state")
      .select("baby_name")
      .eq("id", 1)
      .maybeSingle();
    const key = s?.baby_name?.trim().toLowerCase();
    if (!key) throw new Error("Set the baby's name first");
    const { data: correct } = await supabaseAdmin.from("guesses").select("id").eq("guess_key", key);
    const pick = correct?.length ? correct[Math.floor(Math.random() * correct.length)].id : null;
    await supabaseAdmin
      .from("event_state")
      .update({ winner_id: pick, updated_at: new Date().toISOString() })
      .eq("id", 1);
    return loadHostData();
  });
export const hostDeleteEntries = createServerFn({ method: "POST" })
  .validator((d: unknown) => deleteEntriesSchema.parse(d))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    const ids = data.ids ?? [];
    if (!data.all && !ids.length) throw new Error("Select at least one entry to remove");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("event_state").update({ winner_id: null }).eq("id", 1);
    const q = supabaseAdmin.from("guesses").delete();
    const { error } = data.all ? await q.not("id", "is", null) : await q.in("id", ids);
    if (error) throw new Error("Could not remove entries. Please try again.");
    return loadHostData();
  });
export const hostSaveName = createServerFn({ method: "POST" })
  .validator((d: unknown) => nameMutationSchema.parse(d))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    if (!data.name) throw new Error("Enter a name");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const values = {
      name: data.name,
      is_active: data.isActive ?? true,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    };
    const { error } = data.id
      ? await supabaseAdmin.from("guess_names").update(values).eq("id", data.id)
      : await supabaseAdmin.from("guess_names").insert(values);
    if (error?.code === "23505") throw new Error("That name already exists");
    if (error) throw new Error("Could not save the name");
    return loadHostData();
  });
export const hostSetNameActive = createServerFn({ method: "POST" })
  .validator((d: unknown) => nameMutationSchema.parse(d))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    if (!data.id || data.isActive === undefined) throw new Error("Invalid name update");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("guess_names")
      .update({ is_active: data.isActive, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("deleted_at", null);
    return loadHostData();
  });
export const hostArchiveName = createServerFn({ method: "POST" })
  .validator((d: unknown) => nameMutationSchema.parse(d))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    if (!data.id) throw new Error("Invalid name");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("guess_names")
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return loadHostData();
  });
