interface AvatarProps {
  name: string;
  color: string;
  size?: number;
}

export default function Avatar({ name, color, size }: AvatarProps) {
  return (
    <span
      className="avatar"
      style={{
        background: color,
        width: size,
        height: size,
        fontSize: size ? size * 0.45 : undefined,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
