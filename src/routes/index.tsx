import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Baby, Heart, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";

import bgImage from "@/assets/aurora-bg.jpg";
import { getPublicBoard, submitGuess } from "@/lib/guessing.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Guess the Baby's Name — Scan, Guess & Win" },
      {
        name: "description",
        content:
          "Scan, add your name and email, and guess what the newborn will be called. One guess per guest, and a lucky draw decides the winner.",
      },
      { property: "og:title", content: "Guess the Baby's Name — Scan, Guess & Win" },
      {
        property: "og:description",
        content: "Leave your guess for the newborn's name and join the lucky draw.",
      },
    ],
  }),
  component: GuestPage,
});

function GuestPage() {
  const board = useServerFn(getPublicBoard);
  const submit = useServerFn(submitGuess);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["board"],
    queryFn: () => board(),
    refetchInterval: 10000,
  });

  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [guessName, setGuessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: (vars: { guestName: string; email: string; guessName: string }) =>
      submit({ data: vars }),
    onSuccess: (res) => {
      if (res.ok) {
        setDone(true);
        setError(null);
        queryClient.invalidateQueries({ queryKey: ["board"] });
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    },
    onError: (e: Error) => setError(e.message.replace(/^Error:\s*/, "")),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (guestName.trim().length < 2) return setError("Please enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Please enter a valid email.");
    if (guessName.trim().length < 2) return setError("Please enter a name guess.");
    mutation.mutate({
      guestName: guestName.trim(),
      email: email.trim(),
      guessName: guessName.trim(),
    });
  }

  const revealed = data?.revealed ?? false;

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-6 sm:py-16">
      <img
        src={bgImage}
        alt=""
        aria-hidden="true"
        width={1920}
        height={1280}
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="soft-orb -top-24 -left-20 h-72 w-72 -z-10 bg-blush" />
      <div className="soft-orb top-1/3 -right-24 h-80 w-80 -z-10 bg-sky" />
      <div className="soft-orb bottom-0 left-1/4 h-64 w-64 -z-10 bg-mint" />

      <div className="mx-auto w-full max-w-2xl">
        <header className="text-center">
          <span className="glass-panel inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold tracking-widest uppercase">
            <Baby className="h-3.5 w-3.5" aria-hidden="true" />
            A new arrival
          </span>
          <h1 className="text-gradient mt-6 text-4xl leading-tight sm:text-6xl">
            Guess the baby's name
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
            Welcome, dear guest. Leave your name, your email and the name you think the little one
            will be given. One guess per person — the closest heart wins.
          </p>
        </header>

        {revealed && (
          <section className="glass-panel mt-8 p-6 text-center sm:p-8">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              The name is
            </p>
            <p className="text-gradient mt-2 font-[family-name:var(--font-display)] text-4xl sm:text-5xl">
              {data?.babyName}
            </p>
            {data?.winner ? (
              <p className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="font-semibold">{data.winner.guestName}</span>
                <span className="text-muted-foreground">guessed it right and won the draw</span>
              </p>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">
                The lucky draw hasn't been spun yet.
              </p>
            )}
          </section>
        )}

        {!revealed &&
          (done ? (
            <section className="glass-panel mt-8 p-8 text-center">
              <Heart className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-2xl">Your guess is in</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Thank you, {guestName.split(" ")[0]}. You guessed{" "}
                <span className="font-semibold text-foreground">{guessName}</span>. Stay close for
                the reveal.
              </p>
            </section>
          ) : (
            <form onSubmit={onSubmit} className="glass-panel mt-8 space-y-4 p-6 sm:p-8">
              <div>
                <label htmlFor="guestName" className="text-sm font-medium">
                  Your name
                </label>
                <input
                  id="guestName"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={80}
                  placeholder="Aisha Rahman"
                  className="glass-field mt-1.5 w-full px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="email" className="text-sm font-medium">
                  Your email
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  placeholder="you@example.com"
                  className="glass-field mt-1.5 w-full px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Used only to keep entries unique — one guess per email.
                </p>
              </div>
              <div>
                <label htmlFor="guessName" className="text-sm font-medium">
                  Your guess for the baby's name
                </label>
                <input
                  id="guessName"
                  value={guessName}
                  onChange={(e) => setGuessName(e.target.value)}
                  maxLength={60}
                  placeholder="Ayaan"
                  className="glass-field mt-1.5 w-full px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
              </div>

              {error && <p className="text-sm font-medium text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full rounded-[var(--radius-lg)] bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground shadow-lg transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
              >
                {mutation.isPending ? "Sending…" : "Submit my guess"}
              </button>
            </form>
          ))}

        <section className="glass-panel mt-6 p-6 sm:p-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <h2 className="flex min-w-0 items-center gap-2 truncate text-xl">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              Names on the board
            </h2>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" aria-hidden="true" />
              {data?.total ?? 0}
            </span>
          </div>

          {data && data.guesses.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {data.guesses.map((g) => (
                <li
                  key={g.name.toLowerCase()}
                  className="glass-field flex items-center gap-2 px-3.5 py-2 text-sm"
                >
                  <span className="font-medium">{g.name}</span>
                  {g.count > 1 && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                      ×{g.count}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No guesses yet — be the very first one.
            </p>
          )}
        </section>

        <footer className="mt-8 flex flex-col items-center justify-center gap-3 text-center text-xs text-muted-foreground sm:flex-row">
          <span>Made with love for the newest member of the family.</span>
          <Link
            to="/host"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-foreground/70 transition hover:bg-white/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Host admin
          </Link>
        </footer>
      </div>
    </main>
  );
}
