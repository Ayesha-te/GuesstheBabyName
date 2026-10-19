import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Baby, Heart, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import bgImage from "@/assets/aurora-bg.jpg";
import { BabyNameRevealDialog } from "@/components/BabyNameRevealDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPublicBoard, submitGuess } from "@/lib/guessing.functions";
import { normalizeMobile } from "@/lib/guessing.helpers";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Guess the Baby's Name — Scan, Guess & Win" },
      {
        name: "description",
        content: "Choose a name for the newest arrival and join the lucky draw.",
      },
    ],
  }),
  component: GuestPage,
});

function GuestPage() {
  const board = useServerFn(getPublicBoard),
    submit = useServerFn(submitGuess),
    qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["board"],
    queryFn: () => board(),
    refetchInterval: 10000,
  });
  const [type, setType] = useState<"adult" | "kid">("adult"),
    [guestName, setGuestName] = useState(""),
    [mobile, setMobile] = useState(""),
    [guardian, setGuardian] = useState(""),
    [guessId, setGuessId] = useState(""),
    [error, setError] = useState<string | null>(null),
    [done, setDone] = useState(false),
    [dialog, setDialog] = useState(false);
  const previous = useRef<boolean>();
  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data:
          type === "adult"
            ? { entryType: "adult" as const, guestName, mobile, guessNameId: guessId }
            : {
                entryType: "kid" as const,
                guestName,
                guardianName: guardian,
                guessNameId: guessId,
              },
      }),
    onSuccess: (r) => {
      if (r.ok) {
        setDone(true);
        setError(null);
        void qc.invalidateQueries({ queryKey: ["board"] });
      } else setError(r.error ?? "Something went wrong.");
    },
    onError: (e: Error) => setError(e.message.replace(/^Error:\s*/, "")),
  });
  useEffect(() => {
    if (data) {
      if (previous.current === false && data.revealed) setDialog(true);
      previous.current = data.revealed;
    }
  }, [data]);
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (guestName.trim().length < 2)
      return setError(
        type === "kid" ? "Please enter the child's name." : "Please enter your full name.",
      );
    if (type === "adult" && !normalizeMobile(mobile))
      return setError("Enter a valid mobile number with 7–15 digits.");
    if (!guessId) return setError("Please choose a name guess.");
    mutation.mutate();
  }
  const revealed = data?.revealed ?? false;
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-6 sm:py-16">
      <img
        src={bgImage}
        alt=""
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="soft-orb -top-24 -left-20 -z-10 h-72 w-72 bg-blush" />
      <div className="soft-orb top-1/3 -right-24 -z-10 h-80 w-80 bg-sky" />
      <BabyNameRevealDialog
        babyName={data?.babyName ?? ""}
        open={dialog}
        onOpenChange={setDialog}
      />
      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <header className="text-center">
          <span className="glass-panel inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold tracking-widest uppercase">
            <Baby className="h-3.5 w-3.5" />A new arrival
          </span>
          <h1 className="text-gradient mt-6 text-4xl leading-tight sm:text-6xl">
            Guess the baby's name
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
            Choose the name you think the little one will be given. Grown-ups and little guessers
            are both welcome.
          </p>
        </header>
        {revealed && (
          <section className="glass-panel mt-8 p-6 text-center sm:p-8">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              The name is
            </p>
            <p className="text-gradient reveal-name mt-2 font-[family-name:var(--font-display)] text-4xl sm:text-5xl">
              {data?.babyName}
            </p>
            {data?.winner ? (
              <p className="winner-celebration mt-5 inline-flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-primary" />
                <b>{data.winner.guestName}</b> won the draw
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
              <Heart className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-4 text-2xl">Your guess is in</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Thank you, {guestName.split(" ")[0]}. Stay close for the reveal.
              </p>
            </section>
          ) : (
            <form onSubmit={onSubmit} className="glass-panel mt-8 p-6 sm:p-8">
              <Tabs
                value={type}
                onValueChange={(v) => {
                  setType(v as "adult" | "kid");
                  setError(null);
                }}
              >
                <TabsList className="glass-field grid h-auto w-full grid-cols-2 p-1">
                  <TabsTrigger value="adult" className="py-2.5">
                    Adults
                  </TabsTrigger>
                  <TabsTrigger value="kid" className="py-2.5">
                    Kids
                  </TabsTrigger>
                </TabsList>
                <TabsContent value={type} className="mt-5 space-y-4">
                  <Field
                    label={type === "adult" ? "Full Name" : "Child Name"}
                    value={guestName}
                    set={setGuestName}
                    placeholder={type === "adult" ? "Your full name" : "Little guesser's name"}
                  />
                  {type === "adult" ? (
                    <Field
                      label="Mobile Number"
                      value={mobile}
                      set={setMobile}
                      placeholder="Your phone number"
                      inputMode="tel"
                    />
                  ) : (
                    <Field
                      label="Parent or Guardian Name (optional)"
                      value={guardian}
                      set={setGuardian}
                      placeholder="For context only"
                    />
                  )}
                  <div>
                    <label className="text-sm font-medium">Name Guess</label>
                    <Select
                      value={guessId}
                      onValueChange={setGuessId}
                      disabled={isLoading || isError || !data?.names.length}
                    >
                      <SelectTrigger className="glass-field mt-1.5 h-12 w-full px-4">
                        <SelectValue
                          placeholder={
                            isLoading
                              ? "Loading names…"
                              : isError
                                ? "Names couldn't load"
                                : data?.namesReady === false
                                  ? "Name list needs setup"
                                  : data?.names.length
                                    ? "Choose a name"
                                    : "No names available"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {data?.names.map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isError && (
                      <p className="mt-1.5 text-xs text-destructive">
                        Please refresh and try again.
                      </p>
                    )}
                    {!isLoading && !isError && data?.names.length === 0 && (
                      <p className="mt-1.5 text-xs font-medium text-foreground/70">
                        {data.namesReady
                          ? "The host is preparing the name list."
                          : "Name choices are being set up. Please check back shortly."}
                      </p>
                    )}
                  </div>
                  {error && (
                    <p role="alert" className="text-sm font-medium text-destructive">
                      {error}
                    </p>
                  )}
                  <button
                    disabled={mutation.isPending || isLoading || !data?.names.length}
                    className="w-full rounded-[var(--radius-lg)] bg-primary px-5 py-3.5 font-semibold text-primary-foreground shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted-foreground/35 disabled:text-foreground/60 disabled:shadow-none"
                  >
                    {mutation.isPending ? "Sending…" : "Submit my guess"}
                  </button>
                </TabsContent>
              </Tabs>
            </form>
          ))}
        <section className="glass-panel mt-6 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl">
              <Sparkles className="h-4 w-4 text-primary" />
              Names on the board
            </h2>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {data?.total ?? 0}
            </span>
          </div>
          {data?.guesses.length ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {data.guesses.map((g) => (
                <li key={g.name.toLowerCase()} className="glass-field px-3.5 py-2 text-sm">
                  <b>{g.name}</b>
                  {g.count > 1 && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs">
                      ×{g.count}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {isLoading
                ? "Loading the board…"
                : isError
                  ? "The board couldn't load. Please try again soon."
                  : "No guesses yet — be the very first one."}
            </p>
          )}
        </section>
        <footer className="mt-8 flex flex-col items-center gap-3 text-center text-xs text-muted-foreground sm:flex-row sm:justify-center">
          <span>Made with love for the newest member of the family.</span>
          <Link
            to="/host"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-foreground/70 hover:bg-white/35"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Host admin
          </Link>
        </footer>
      </div>
    </main>
  );
}
function Field({
  label,
  value,
  set,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  placeholder: string;
  inputMode?: "tel";
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        maxLength={80}
        placeholder={placeholder}
        inputMode={inputMode}
        className="glass-field mt-1.5 w-full px-4 py-3 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
