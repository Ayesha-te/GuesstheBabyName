type CelebrationEffectsProps = {
  density?: "normal" | "compact";
  variant?: "contained" | "screen";
};

export function CelebrationEffects({
  density = "normal",
  variant = "contained",
}: CelebrationEffectsProps) {
  const balloonCount = variant === "screen" ? 9 : density === "compact" ? 3 : 5;
  const burstCount = variant === "screen" ? 8 : density === "compact" ? 3 : 5;

  return (
    <div className={`celebration-effects ${variant === "screen" ? "celebration-screen" : ""}`} aria-hidden="true">
      {Array.from({ length: balloonCount }).map((_, index) => (
        <span key={`balloon-${index}`} className={`celebration-balloon balloon-${index + 1}`} />
      ))}
      {Array.from({ length: burstCount }).map((_, index) => (
        <span key={`burst-${index}`} className={`firework-burst burst-${index + 1}`} />
      ))}
      <span className="confetti-ribbon ribbon-1" />
      <span className="confetti-ribbon ribbon-2" />
    </div>
  );
}
