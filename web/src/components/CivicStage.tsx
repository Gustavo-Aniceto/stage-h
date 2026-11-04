/** Arte do hero da Stage H: garagem roxa com o Honda Civic EK 2000 e rodas BBS prata (imagem completa, sem 3D). */
export const HERO_IMG = "/brand/hero-stage-h.webp";
/** Recorte para telas estreitas: mantém o carro grande quando o texto vai para cima da imagem. */
export const HERO_IMG_MOBILE = "/brand/hero-stage-h-mobile.webp";

/**
 * Imagem de fundo do hero. `stackAt` é a largura de tela (px) abaixo da qual o hero empilha
 * (texto em cima, imagem embaixo) e troca para o recorte mobile; precisa bater com os
 * breakpoints `.sh-hero` / `.sh-hero-site` do theme-stageh.css.
 */
export function CivicStage({ className = "", stackAt = 1200 }: { className?: string; stackAt?: number }) {
  return (
    <picture className={`sh-stage ${className}`.trim()}>
      <source media={`(max-width: ${stackAt}px)`} srcSet={HERO_IMG_MOBILE} width={1046} height={504} />
      <img
        className="sh-poster"
        src={HERO_IMG}
        alt="Honda Civic EK 2000 roxo com rodas BBS prata na garagem da Stage H"
        width={1416}
        height={504}
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}
