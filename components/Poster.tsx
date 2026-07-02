type PosterProps = {
  emoji: string;
  colors: [string, string];
  title?: string;
  mini?: boolean;
};

export default function Poster({ emoji, colors, title, mini }: PosterProps) {
  return (
    <div
      className={`poster${mini ? " mini" : ""}`}
      style={{
        background: `linear-gradient(160deg, ${colors[1]} 0%, ${colors[0]} 78%)`,
      }}
    >
      <span className="emoji">{emoji}</span>
      {!mini && title && <span className="label">{title}</span>}
    </div>
  );
}
