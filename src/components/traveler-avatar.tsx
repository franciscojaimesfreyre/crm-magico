import clsx from "clsx";
import { Avatar } from "@/components/ui";
import type { ResolvedAvatar } from "@/lib/avatars";

const SIZES = {
  xs: { box: "size-7 rounded-lg", text: "text-[11px]" },
  sm: { box: "size-9 rounded-xl", text: "text-xs" },
  md: { box: "size-12 rounded-xl", text: "text-sm" },
  lg: { box: "size-20 rounded-2xl", text: "text-xl" },
  xl: { box: "size-28 rounded-[22px]", text: "text-2xl" },
} as const;

/**
 * El personaje de un viajero: su ilustración (o la imagen de la agencia) en un cuadrado redondeado, como
 * los perfiles de las plataformas de streaming. Sin personaje, las iniciales de siempre.
 */
export function TravelerAvatar({
  avatar,
  name,
  size = "sm",
  className,
}: {
  avatar: ResolvedAvatar | null;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  if (!avatar) {
    return <Avatar name={name} className={clsx(s.box, s.text, "rounded-full", className)} />;
  }
  return (
    <span
      role="img"
      aria-label={`${name}: ${avatar.label}`}
      title={avatar.label}
      className={clsx("relative inline-block shrink-0 overflow-hidden", s.box, className)}
      style={{ backgroundColor: avatar.color }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatar.src} alt="" loading="lazy" className="size-full object-cover" />
    </span>
  );
}
