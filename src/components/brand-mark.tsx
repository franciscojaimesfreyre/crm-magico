import clsx from "clsx";

/** La marca del producto: una estrella de cuatro puntas (el "mágico") en el color de marca. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={clsx("size-8 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="16" className="fill-brand-600" />
      <path d="M16 6.5c.9 5.2 3.3 7.6 8.5 8.5-5.2.9-7.6 3.3-8.5 8.5-.9-5.2-3.3-7.6-8.5-8.5 5.2-.9 7.6-3.3 8.5-8.5Z" fill="#fff" />
      <circle cx="23.5" cy="8.5" r="1.6" fill="#fff" opacity=".85" />
    </svg>
  );
}
