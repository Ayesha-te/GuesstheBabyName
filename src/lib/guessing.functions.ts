import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const guessSchema = z.object({
  guestName: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(255),
  guessName: z.string().trim().min(2, "Enter a name guess").max(60),
});

const passcodeSchema = z.object({ passcode: z.string().min(1).max(200) });

export type BoardGuess = { name: string; count: number };

export type PublicBoard = {
  total: number;
  guesses: BoardGuess[];
  revealed: boolean;
  babyName: string | null;
  winner: { guestName: string; guessName: string } | null;
};

function maskName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export const getPublicBoard = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicBoard> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: rows }, { data: state }] = await Promise.all([
      supabaseAdmin.from("guesses").select("id, guest_name, guess_name, guess_key"),
      supabaseAdmin.from("event_state").select("*").eq("id", 1).maybeSingle(),
    ]);

    const tally = new Map<string, { name: string; count: number }>();
    for (const row of rows ?? []) {
      const key = row.guess_key ?? row.guess_name.trim().toLowerCase();
      const existing = tally.get(key);
      if (existing) existing.count += 1;
      else tally.set(key, { name: row.guess_name.trim(), count: 1 });
    }

    const winnerRow = state?.winner_id
      ? (rows ?? []).find((r) => r.id === state.winner_id)
      : undefined;

    return {
      total: rows?.length ?? 0,
      guesses: [...tally.values()].sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name),
      ),
      revealed: Boolean(state?.revealed),
      babyName: state?.revealed ? (state?.baby_name ?? null) : null,
      winner: winnerRow
        ? { guestName: maskName(winnerRow.guest_name), guessName: winnerRow.guess_name }
        : null,
    };
  },
);

export const submitGuess = createServerFn({ method: "POST" })
  .validator((data: unknown) => guessSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: state } = await supabaseAdmin
      .from("event_state")
      .select("revealed")
      .eq("id", 1)
      .maybeSingle();

    if (state?.revealed) {
      return { ok: false, error: "Guessing is closed — the name has already been revealed." };
    }

    const { error } = await supabaseAdmin.from("guesses").insert({
      guest_name: data.guestName,
      email: data.email.toLowerCase(),
      guess_name: data.guessName,
    });

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "This email has already submitted a guess." };
      }
      return { ok: false, error: "Something went wrong. Please try again." };
    }

    return { ok: true };
  });

export type HostEntry = {
  id: string;
  guestName: string;
  email: string;
  guessName: string;
  createdAt: string;
};

export type HostData = {
  entries: HostEntry[];
  babyName: string | null;
  revealed: boolean;
  winnerId: string | null;
};

async function loadHostData(): Promise<HostData> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: rows }, { data: state }] = await Promise.all([
    supabaseAdmin
      .from("guesses")
      .select("id, guest_name, email, guess_name, created_at")
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("event_state").select("*").eq("id", 1).maybeSingle(),
  ]);

  return {
    entries: (rows ?? []).map((r) => ({
      id: r.id,
      guestName: r.guest_name,
      email: r.email,
      guessName: r.guess_name,
      createdAt: r.created_at,
    })),
    babyName: state?.baby_name ?? null,
    revealed: Boolean(state?.revealed),
    winnerId: state?.winner_id ?? null,
  };
}

function assertHost(passcode: string) {
  const expected = process.env.HOST_PASSCODE;
  if (!expected || passcode !== expected) {
    throw new Error("Incorrect host passcode");
  }
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("event_state")
      .update({ baby_name: data.babyName, revealed: true, updated_at: new Date().toISOString() })
      .eq("id", 1);
    return loadHostData();
  });

export const hostDrawWinner = createServerFn({ method: "POST" })
  .validator((data: unknown) => passcodeSchema.parse(data))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: state } = await supabaseAdmin
      .from("event_state")
      .select("baby_name")
      .eq("id", 1)
      .maybeSingle();

    const babyName = state?.baby_name?.trim().toLowerCase();
    if (!babyName) throw new Error("Set the baby's name first");

    const { data: correct } = await supabaseAdmin
      .from("guesses")
      .select("id")
      .eq("guess_key", babyName);

    if (!correct || correct.length === 0) {
      await supabaseAdmin.from("event_state").update({ winner_id: null }).eq("id", 1);
      return { ...(await loadHostData()), correctCount: 0 };
    }

    const pick = correct[Math.floor(Math.random() * correct.length)];
    await supabaseAdmin
      .from("event_state")
      .update({ winner_id: pick.id, updated_at: new Date().toISOString() })
      .eq("id", 1);

    return { ...(await loadHostData()), correctCount: correct.length };
  });

export const hostReset = createServerFn({ method: "POST" })
  .validator((data: unknown) => passcodeSchema.parse(data))
  .handler(async ({ data }) => {
    assertHost(data.passcode);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("event_state")
      .update({ revealed: false, winner_id: null, updated_at: new Date().toISOString() })
      .eq("id", 1);
    return loadHostData();
  });
