const PALETTE = ["#e8e2d6", "#dfe7e2", "#e2e4ee", "#efe1dc", "#e9e3ef"];

/** Instructor initials (no stock headshots). Color is stable per name. */
export default function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const hash = [...name].reduce((h, c) => h + c.charCodeAt(0), 0);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: PALETTE[hash % PALETTE.length] }}>
      {initials}
    </span>
  );
}
