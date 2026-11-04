import { Component, lazy, Suspense, useState, type ReactNode } from "react";

// O three.js só é baixado quando a pessoa pede o 3D (botão "Girar 360°"): login, check-in, OS e
// documentos não carregam nada de 3D, e o painel/site abrem rápido com a foto.
const Civic3D = lazy(() => import("./Civic3D"));

/** Foto do Civic EK roxo da identidade Stage H (recorte da arte de referência, sem textos de terceiros). */
export const CIVIC_POSTER = "/brand/civic-ek-stage-h.webp";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="sh-stage-msg" role="status">Visualizador 3D indisponível agora. O restante do sistema funciona normalmente.</div>
      : this.props.children;
  }
}

/**
 * Palco do Honda Civic. Começa na foto (imagem real, sem fingir 3D); "Girar 360°" abre o
 * visualizador 3D interativo. Falhas no 3D nunca derrubam a página e dá para voltar à foto.
 */
export function CivicStage({ className = "" }: { className?: string }) {
  const [modo, setModo] = useState<"foto" | "3d">("foto");
  return (
    <div className={`sh-stage ${className}`.trim()}>
      {modo === "foto" ? (
        <>
          <img
            className="sh-poster"
            src={CIVIC_POSTER}
            alt="Honda Civic EK 2000 roxo com rodas BBS prata na garagem da Stage H"
            width={1299}
            height={688}
            decoding="async"
            draggable={false}
          />
          <button type="button" className="sh-360" onClick={() => setModo("3d")} title="Abrir o visualizador 3D e girar o Civic">
            <span>360°</span>
            <small>Girar 360°</small>
          </button>
        </>
      ) : (
        <>
          <Boundary>
            <Suspense fallback={<div className="sh-stage-msg" role="status">Carregando Civic 3D…</div>}>
              <Civic3D />
            </Suspense>
          </Boundary>
          <button type="button" className="sh-photo-btn" onClick={() => setModo("foto")}>Ver foto</button>
        </>
      )}
    </div>
  );
}
