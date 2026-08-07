export function PlayerName({
  name,
  flair,
  className = "",
}: {
  name: string;
  flair?: string | null;
  className?: string;
}) {
  return (
    <span className={className}>
      {flair && <span className="mr-1">{flair}</span>}
      {name}
    </span>
  );
}
