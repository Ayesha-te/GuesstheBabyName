import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Dices, KeyRound, Lock, PartyPopper, RotateCcw, Trash2 } from "lucide-react";

import bgImage from "@/assets/aurora-bg.jpg";
import { BabyNameRevealDialog } from "@/components/BabyNameRevealDialog";
import {
  hostDrawWinner,
  hostDeleteEntries,
  hostLoad,
  hostReset,
  hostSetBabyName,
  type HostData,
} from "@/lib/guessing.functions";

export const Route = createFileRoute("/host")({
  head: () => ({
    meta: [
      { title: "Host Console — Reveal & Lucky Draw" },
      {
        name: "description",
        content:
          "Private host console to reveal the baby's real name and spin the random draw among the correct guesses.",
      },
      { property: "og:title", content: "Host Console — Reveal & Lucky Draw" },
      {
        property: "og:description",
        content: "Reveal the newborn's name and randomly pick the winning guest.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const load = useServerFn(hostLoad);
  const setName = useServerFn(hostSetBabyName);
  const draw = useServerFn(hostDrawWinner);
  const reset = useServerFn(hostReset);
  const deleteEntries = useServerFn(hostDeleteEntries);

  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [data, setData] = useState<HostData | null>(null);
  const [babyName, setBabyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState<string | null>(null);
  const [justDrew, setJustDrew] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [revealDialogOpen, setRevealDialogOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function apply(next: HostData) {
    setData(next);
    setBabyName(next.babyName ?? "");
    setSelectedEntryIds((current) =>
      current.filter((id) => next.entries.some((entry) => entry.id === id)),
    );
  }

  async function run<T extends HostData>(fn: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      apply(res);
      return res;
    } catch (e) {
      setError((e as Error).message.replace(/^Error:\s*/, ""));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    const res = await run(() => load({ data: { passcode } }));
    if (res) setUnlocked(true);
  }

  async function onReveal() {
    const res = await run(() => setName({ data: { passcode, babyName } }));
    if (res) setRevealDialogOpen(true);
  }

  async function onReset() {
    const res = await run(() => reset({ data: { passcode } }));
    if (res) setRevealDialogOpen(false);
  }

  async function onDraw() {
    if (!data) return;
    const correct = data.entries.filter(
      (entry) =>
        entry.guessName.trim().toLowerCase() === (data.babyName ?? "").trim().toLowerCase(),
    );
    if (correct.length === 0) {
      await run(() => draw({ data: { passcode } }));
      setJustDrew(true);
      return;
    }

    setJustDrew(false);
    let tick = 0;
    const spin = () => {
      setRolling(correct[Math.floor(Math.random() * correct.length)].guestName);
      tick += 1;
      if (tick < 18) timers.current.push(setTimeout(spin, 60 + tick * 12));
      else {
        void run(() => draw({ data: { passcode } })).then(() => {
          setRolling(null);
          setJustDrew(true);
        });
      }
    };
    spin();
  }

  function toggleEntry(id: string) {
    setSelectedEntryIds((current) =>
      current.includes(id) ? current.filter((entryId) => entryId !== id) : [...current, id],
    );
  }

  function toggleAllEntries() {
    if (!data) return;
    setSelectedEntryIds((current) =>
      current.length === data.entries.length ? [] : data.entries.map((entry) => entry.id),
    );
  }

  async function onDeleteSelected() {
    if (selectedEntryIds.length === 0) return;
    await run(() => deleteEntries({ data: { passcode, ids: selectedEntryIds } }));
  }

  async function onDeleteAll() {
    if (!data || data.entries.length === 0) return;
    const confirmed = window.confirm("Remove all entries? This cannot be undone.");
    if (!confirmed) return;
    await run(() => deleteEntries({ data: { passcode, all: true } }));
    setSelectedEntryIds([]);
  }

  const winner = data?.entries.find((e) => e.id === data.winnerId) ?? null;
  const allEntriesSelected =
    Boolean(data?.entries.length) && selectedEntryIds.length === data?.entries.length;
  const correctEntries =
    data?.entries.filter(
      (e) => e.guessName.trim().toLowerCase() === (data.babyName ?? "").trim().toLowerCase(),
    ) ?? [];

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-12 sm:px-6">
      <img
        src={bgImage}
        alt=""
        aria-hidden="true"
        width={1920}
        height={1280}
        loading="lazy"
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="soft-orb -top-20 right-0 h-72 w-72 -z-10 bg-sky" />
      <div className="soft-orb bottom-10 -left-16 h-72 w-72 -z-10 bg-blush" />
      <BabyNameRevealDialog
        babyName={data?.babyName ?? babyName}
        open={revealDialogOpen}
        onOpenChange={setRevealDialogOpen}
      />

      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <h1 className="text-gradient text-center text-3xl sm:text-5xl">Host console</h1>

        {!unlocked ? (
          <form onSubmit={onUnlock} className="glass-panel mx-auto mt-8 max-w-sm p-6 sm:p-8">
            <Lock className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Enter the host passcode to manage the reveal.
            </p>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
              className="glass-field mt-5 w-full px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
            {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Unlock
            </button>
          </form>
        ) : (
          <div className="mt-8 space-y-6">
            <section className="glass-panel p-6 sm:p-8">
              <h2 className="text-xl">The real name</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Saving the name reveals it to every guest and closes new entries.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={babyName}
                  onChange={(e) => setBabyName(e.target.value)}
                  placeholder="Baby's name"
                  className="glass-field w-full px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={onReveal}
                  disabled={busy || babyName.trim().length === 0}
                  className="shrink-0 rounded-[var(--radius-lg)] bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
                >
                  Reveal
                </button>
              </div>
              {data?.revealed && (
                <button
                  onClick={onReset}
                  disabled={busy}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Hide the reveal and reopen guessing
                </button>
              )}
            </section>

            <section className="glass-panel p-6 text-center sm:p-8">
              <h2 className="text-xl">Lucky draw</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {correctEntries.length} correct {correctEntries.length === 1 ? "guess" : "guesses"}
                {correctEntries.length > 1 ? " — one will be drawn at random." : "."}
              </p>

              <div className="glass-field mx-auto mt-5 flex h-24 max-w-sm items-center justify-center px-4">
                <span
                  className={`relative font-[family-name:var(--font-display)] text-2xl ${
                    rolling ? "opacity-70" : ""
                  }`}
                >
                  {rolling ??
                    winner?.guestName ??
                    (justDrew ? "No correct guesses yet" : "Ready when you are")}
                </span>
              </div>

              {winner && !rolling && (
                <p className="winner-celebration mt-4 inline-flex items-center gap-2 text-sm">
                  <PartyPopper className="h-4 w-4 text-primary" aria-hidden="true" />
                  Winner: <span className="font-semibold">{winner.guestName}</span> ({winner.email})
                </p>
              )}

              <button
                onClick={onDraw}
                disabled={busy || Boolean(rolling) || !data?.babyName}
                className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius-lg)] bg-primary px-7 py-3 font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
              >
                <Dices className="h-4 w-4" aria-hidden="true" />
                {winner ? "Draw again" : "Spin the draw"}
              </button>
            </section>

            <section className="glass-panel p-6 sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl">Entries ({data?.entries.length ?? 0})</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={onDeleteSelected}
                    disabled={busy || selectedEntryIds.length === 0}
                    className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:brightness-110 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove selected ({selectedEntryIds.length})
                  </button>
                  <button
                    onClick={onDeleteAll}
                    disabled={busy || !data?.entries.length}
                    className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove all
                  </button>
                </div>
              </div>
              {Boolean(data?.entries.length) && (
                <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allEntriesSelected}
                    onChange={toggleAllEntries}
                    className="h-4 w-4 accent-primary"
                  />
                  Select all entries
                </label>
              )}
              <ul className="mt-4 divide-y divide-border">
                {data?.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEntryIds.includes(entry.id)}
                      onChange={() => toggleEntry(entry.id)}
                      aria-label={`Select ${entry.guestName}`}
                      className="h-4 w-4 accent-primary"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.guestName}</p>
                      <p className="truncate text-xs text-muted-foreground">{entry.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
                      {entry.guessName}
                    </span>
                  </li>
                ))}
              </ul>
              {data?.entries.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">No entries yet.</p>
              )}
            </section>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
