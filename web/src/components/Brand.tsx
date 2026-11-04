/** Logo oficial da Stage H (arquivo enviado pela oficina, sem redesenho). */
export const LOGO_SRC = "/brand/logo-stageh.png";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Stage H"
      width={544}
      height={216}
      decoding="async"
      className={`brand-logo ${className}`.trim()}
    />
  );
}
