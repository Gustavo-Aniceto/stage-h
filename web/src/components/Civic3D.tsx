import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Visualizador 3D do Honda Civic EK (1999/2000) roxo.
 *
 * - Se existir /models/civic-ek.glb (public/models/civic-ek.glb), ele é carregado, centralizado e
 *   escalado automaticamente. Esse é o caminho para o visual realista da imagem de referência.
 * - Sem o arquivo, usa um Civic EK 3D procedural PROVISÓRIO (geometria real, mas simplificada).
 * - Arrastar (mouse ou dedo na horizontal) gira; setas do teclado também; o botão 360° liga/desliga o giro.
 * - A rolagem vertical da página continua funcionando por cima do palco no celular (touch-action: pan-y).
 */
const MODEL_URL = "/models/civic-ek.glb";
const CAR_LENGTH = 4.45;
const NEON = 0x8b00ff;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Mancha de luz roxa sob o carro (iluminação neon do chão). */
function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(139,0,255,0.9)");
  grad.addColorStop(0.45, "rgba(105,0,216,0.35)");
  grad.addColorStop(1, "rgba(105,0,216,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Máscara radial para o chão se dissolver no fundo (sem borda de disco). */
function fadeTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.6, "#777777");
  grad.addColorStop(1, "#000000");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function extrude(shape: THREE.Shape, depth: number, bevel: number): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 28,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Roda de liga leve estilo BBS (aro prata com raios cruzados). Eixo em Z, face externa em +Z. */
function makeWheel(m: { rubber: THREE.Material; silver: THREE.Material; dark: THREE.Material }): THREE.Group {
  const w = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.315, 0.2, 56), m.rubber);
  tire.rotation.x = Math.PI / 2;
  w.add(tire);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.19, 48), m.dark);
  barrel.rotation.x = Math.PI / 2;
  w.add(barrel);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.02, 12, 56), m.silver);
  lip.position.z = 0.095;
  w.add(lip);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.02, 40), m.dark);
  disc.rotation.x = Math.PI / 2;
  disc.position.z = 0.0;
  w.add(disc);
  const spokeGeo = new THREE.BoxGeometry(0.19, 0.024, 0.02);
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < 12; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.z = (i * Math.PI) / 6 + layer * (Math.PI / 12);
      const s = new THREE.Mesh(spokeGeo, m.silver);
      s.position.set(0.105, 0, 0.07 + layer * 0.014);
      s.rotation.x = layer ? 0.18 : -0.18;
      pivot.add(s);
      w.add(pivot);
    }
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 28), m.silver);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.1;
  w.add(cap);
  return w;
}

/** Civic EK sedan 3D simplificado (provisório até existir um .glb). Frente do carro = +X. */
function buildProceduralCivic(): THREE.Group {
  const car = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x4a0fb0, metalness: 0.8, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.06 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x07070f, metalness: 0.9, roughness: 0.06 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b13, roughness: 0.55, metalness: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0f0f14, roughness: 0.9, metalness: 0 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd8dae0, metalness: 1, roughness: 0.2 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdde6ff, emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 1.8 });
  const neonMat = new THREE.MeshStandardMaterial({ color: NEON, emissive: NEON, emissiveIntensity: 2.4 });

  // Carroceria inferior com os vãos das rodas recortados no perfil lateral.
  const y0 = 0.27, ra = 0.41, rc = -1.3, fc = 1.3;
  const s = new THREE.Shape();
  s.moveTo(-2.14, 0.36);
  s.lineTo(rc - ra, y0);
  s.absarc(rc, y0, ra, Math.PI, 0, true);
  s.lineTo(fc - ra, y0);
  s.absarc(fc, y0, ra, Math.PI, 0, true);
  s.lineTo(2.14, 0.34);
  s.lineTo(2.24, 0.5);
  s.lineTo(2.2, 0.68);
  s.quadraticCurveTo(2.12, 0.79, 1.85, 0.83);
  s.lineTo(0.98, 0.93);
  s.lineTo(-1.55, 0.97);
  s.lineTo(-2.1, 0.92);
  s.lineTo(-2.17, 0.7);
  s.lineTo(-2.14, 0.36);
  const body = new THREE.Mesh(extrude(s, 1.72, 0.06), paint);
  body.castShadow = true;
  car.add(body);

  // Cabine (vidros) e teto.
  const c = new THREE.Shape();
  c.moveTo(-1.42, 0.93);
  c.lineTo(-0.62, 1.34);
  c.lineTo(0.22, 1.34);
  c.lineTo(1.02, 0.93);
  c.lineTo(-1.42, 0.93);
  const cabin = new THREE.Mesh(extrude(c, 1.38, 0.05), glass);
  cabin.castShadow = true;
  car.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.05, 1.34), paint);
  roof.position.set(-0.12, 1.375, 0);
  car.add(roof);
  const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 1.52), paint);
  bPillar.position.set(-0.12, 1.13, 0);
  car.add(bPillar);

  // Frente, traseira e detalhes.
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(0, ry, rz);
    car.add(m);
    return m;
  };
  for (const side of [1, -1]) {
    add(new THREE.BoxGeometry(0.05, 0.09, 0.36), headMat, 2.19, 0.73, 0.58 * side, -0.3 * side);
    add(new THREE.BoxGeometry(0.04, 0.12, 0.42), tailMat, -2.18, 0.8, 0.62 * side, 0.12 * side);
    add(new THREE.BoxGeometry(0.12, 0.09, 0.2), paint, 0.9, 1.0, 0.99 * side);
    add(new THREE.BoxGeometry(3.0, 0.02, 0.02), neonMat, 0, 0.2, 0.8 * side);
    for (const x of [0.62, -0.12, -0.88]) add(new THREE.BoxGeometry(0.012, 0.42, 0.01), dark, x, 0.66, 0.935 * side);
  }
  add(new THREE.BoxGeometry(0.05, 0.07, 0.55), dark, 2.24, 0.6, 0);
  add(new THREE.BoxGeometry(0.05, 0.1, 0.92), dark, 2.22, 0.42, 0);
  add(new THREE.BoxGeometry(0.24, 0.03, 1.36), paint, -2.02, 1.0, 0, 0, -0.1);

  // Rodas.
  for (const x of [1.3, -1.3]) {
    for (const z of [0.76, -0.76]) {
      const w = makeWheel({ rubber, silver, dark });
      w.position.set(x, 0.315, z);
      if (z < 0) w.rotation.y = Math.PI;
      car.add(w);
    }
  }
  return car;
}

/** Normaliza um .glb: frente para +X, comprimento de 4,45 u, centralizado e apoiado no chão. */
function fitModel(obj: THREE.Object3D): THREE.Group {
  const wrap = new THREE.Group();
  wrap.add(obj);
  const box = new THREE.Box3().setFromObject(wrap);
  const size = box.getSize(new THREE.Vector3());
  if (size.z > size.x) {
    wrap.rotation.y = Math.PI / 2;
    wrap.updateMatrixWorld(true);
    box.setFromObject(wrap);
    box.getSize(size);
  }
  wrap.scale.setScalar(CAR_LENGTH / size.x);
  wrap.updateMatrixWorld(true);
  box.setFromObject(wrap);
  const center = box.getCenter(new THREE.Vector3());
  wrap.position.set(-center.x, -box.min.y, -center.z);
  wrap.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return wrap;
}

export default function Civic3D() {
  const hostRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef(true);
  const [auto, setAuto] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [state, setState] = useState<"loading" | "ready" | "nowebgl">("loading");

  useEffect(() => { autoRef.current = auto; }, [auto]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setState("nowebgl");
      return;
    }
    let disposed = false;
    const canvas = renderer.domElement;
    canvas.className = "sh-3d-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, host.firstChild);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;

    const camera = new THREE.PerspectiveCamera(32, 1.6, 0.1, 60);

    // Iluminação: chave suave + luzes neon roxas e azuis + brilho sob o carro.
    const key = new THREE.DirectionalLight(0xdfe3ff, 1.4);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
    scene.add(key);
    const neonA = new THREE.PointLight(NEON, 55, 12, 2); neonA.position.set(-3.2, 1.6, 2.6); scene.add(neonA);
    const neonB = new THREE.PointLight(0x3a5bff, 40, 12, 2); neonB.position.set(3.4, 1.4, -2.8); scene.add(neonB);
    const neonC = new THREE.PointLight(NEON, 38, 10, 2); neonC.position.set(0, 3.2, 0); scene.add(neonC);
    const under = new THREE.PointLight(NEON, 22, 4, 2); under.position.set(0, 0.12, 0); scene.add(under);

    // Chão escuro e brilhante, que se dissolve no fundo, mais o halo roxo.
    const fade = fadeTexture();
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(7, 64),
      new THREE.MeshStandardMaterial({ color: 0x0d0d1a, roughness: 0.28, metalness: 0.7, transparent: true, alphaMap: fade }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const glowTex = glowTexture();
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 3.4),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.006;
    scene.add(glow);

    // Controle de câmera (órbita horizontal; inclinação só com mouse).
    let yaw = 0.9, pitch = 0.12, radius = 7.2, vel = 0, dragging = false, lastX = 0, lastY = 0, lastMove = 0;
    const place = () => {
      const cp = Math.cos(pitch);
      camera.position.set(Math.sin(yaw) * cp * radius, 0.62 + Math.sin(pitch) * radius, Math.cos(yaw) * cp * radius);
      camera.lookAt(0, 0.6, 0);
    };
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      radius = 7.2 * Math.max(1, 1.5 / camera.aspect);
    };
    const onDown = (e: PointerEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY; vel = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      yaw -= dx * 0.008; vel = -dx * 0.008;
      if (e.pointerType === "mouse") pitch = clamp(pitch + dy * 0.004, 0.03, 0.55);
      lastMove = performance.now();
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* já liberado */ }
      canvas.style.cursor = "grab";
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      yaw += e.key === "ArrowLeft" ? 0.14 : -0.14;
      lastMove = performance.now();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    host.addEventListener("keydown", onKey);

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(host);

    let raf = 0, last = performance.now();
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!visible || document.hidden) return;
      if (!dragging) {
        if (Math.abs(vel) > 0.0005) { yaw += vel; vel *= 0.94; }
        else if (autoRef.current && performance.now() - lastMove > 2000) yaw += dt * 0.35;
      }
      place();
      renderer.render(scene, camera);
    };
    place();
    raf = requestAnimationFrame(tick);

    const mount = (model: THREE.Object3D, origem: string) => {
      if (disposed) return;
      scene.add(model);
      console.info(`[Stage H] Civic 3D: ${origem}`);
      setState("ready");
    };
    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => mount(fitModel(gltf.scene), "modelo .glb"),
      undefined,
      () => mount(buildProceduralCivic(), "modelo provisório (sem /models/civic-ek.glb)"),
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((mt) => mt.dispose());
      });
      fade.dispose(); glowTex.dispose(); pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="sh-3d"
      tabIndex={0}
      role="group"
      aria-label="Honda Civic roxo em 3D. Arraste ou use as setas do teclado para girar."
    >
      {state === "loading" && <div className="sh-stage-msg" role="status">Carregando Civic 3D…</div>}
      {state === "nowebgl" && <div className="sh-stage-msg" role="status">Este aparelho não suporta gráficos 3D (WebGL).</div>}
      {state === "ready" && <span className="sh-hint" aria-hidden>Arraste para girar</span>}
      {state !== "nowebgl" && (
        <button type="button" className="sh-360" aria-pressed={auto} onClick={() => setAuto((a) => !a)}
          title={auto ? "Parar giro automático" : "Girar automaticamente"}>
          <span>360°</span>
          <small>{auto ? "Girando" : "Girar 360°"}</small>
        </button>
      )}
    </div>
  );
}
