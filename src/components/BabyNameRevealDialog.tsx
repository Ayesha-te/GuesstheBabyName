import { Sparkles } from "lucide-react";

import { CelebrationEffects } from "@/components/CelebrationEffects";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BabyNameRevealDialogProps = {
  babyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BabyNameRevealDialog({ babyName, open, onOpenChange }: BabyNameRevealDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="reveal-dialog w-[calc(100%-2rem)] max-w-xl overflow-hidden border-white/70 bg-[var(--glass)] p-0 shadow-2xl backdrop-blur-3xl sm:rounded-[var(--radius-2xl)]">
        <CelebrationEffects />
        <div className="relative z-10 flex min-h-96 flex-col justify-between px-6 py-8 text-center sm:px-12 sm:py-10">
          <DialogHeader className="items-center space-y-2 text-center">
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              <Sparkles className="h-4 w-4" aria-hidden="true" />A beautiful beginning
            </span>
            <DialogTitle className="text-2xl text-foreground sm:text-3xl">
              Meet the little one
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              The wait is over. We are delighted to reveal the baby's name.
            </DialogDescription>
          </DialogHeader>

          <div className="my-7 rounded-[var(--radius-2xl)] border border-white/70 bg-white/65 px-4 py-7 shadow-[0_18px_50px_-30px_oklch(0.4_0.12_320/55%)] backdrop-blur-sm">
            <p className="text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
              Welcome, baby
            </p>
            <p className="text-gradient reveal-name mt-2 break-words font-[family-name:var(--font-display)] text-5xl leading-tight sm:text-7xl">
              {babyName}
            </p>
          </div>

          <DialogFooter className="sm:justify-center">
            <DialogClose className="rounded-[var(--radius-lg)] bg-primary px-7 py-3 font-semibold text-primary-foreground shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Celebrate with us
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
