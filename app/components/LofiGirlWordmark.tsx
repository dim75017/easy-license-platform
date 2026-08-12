type LofiGirlWordmarkProps = {
  className?: string;
  decorative?: boolean;
};

export function LofiGirlWordmark({ className = "", decorative = false }: LofiGirlWordmarkProps) {
  const classes = ["lofi-girl-wordmark", className].filter(Boolean).join(" ");

  if (decorative) {
    return <span className={classes} aria-hidden="true" />;
  }

  return <span className={classes} role="img" aria-label="Lofi Girl" />;
}
