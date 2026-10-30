import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Look, Pack } from "../types";
import { performersAt, videoAt } from "../lib/engine";

/**
 * A real WebGL previz path. The SVG canvas remains the fast, legible default;
 * this is the "show me the room" mode for the studio. It is a design
 * instrument, not a renderer replacement.
 */
export function Stage3D({
  pack,
  look,
  time,
  showGlare = false,
}: {
  pack: Pack;
  look: Look;
  time: number;
  showGlare?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      setFailed(true);
      return;
    }
    const width = element.clientWidth;
    const height = element.clientHeight || width * 0.62;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050607");
    scene.fog = new THREE.Fog("#050607", 26, 64);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200);
    camera.position.set(8.5, 7.5, -13);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.4, 5.5);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 8;
    controls.maxDistance = 55;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.update();

    scene.add(new THREE.AmbientLight(0xbfd0b0, 0.5));
    const hemi = new THREE.HemisphereLight(0xd7ff4f, 0x11150f, 0.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xf5f0e4, 1.9);
    key.position.set(10, 20, -14);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x51e0d2, 0.9);
    rim.position.set(-12, 9, 16);
    scene.add(rim);
    const fill = new THREE.PointLight(0xd7ff4f, 12, 30, 2);
    fill.position.set(0, 6, 2);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x080a08, roughness: 1, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.18;
    scene.add(floor);

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(pack.stage.width, 0.22, pack.stage.depth),
      new THREE.MeshStandardMaterial({ color: 0x141a12, roughness: 0.9, metalness: 0.05 }),
    );
    deck.position.set(0, -0.11, pack.stage.depth / 2);
    scene.add(deck);
    const deckEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(deck.geometry),
      new THREE.LineBasicMaterial({ color: 0xd7ff4f, transparent: true, opacity: 0.45 }),
    );
    deckEdges.position.copy(deck.position);
    scene.add(deckEdges);

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(pack.stage.width, 9.6, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x0a0d0b, roughness: 1 }),
    );
    wall.position.set(0, 4.7, pack.stage.depth + 0.15);
    scene.add(wall);

    // screen
    const screen = pack.stage.screen;
    const screenTexture = makeScreenTexture(pack, time, videoAt(pack, time));
    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(screen.w, screen.h),
      new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }),
    );
    screenMesh.position.set(screen.x, screen.z + screen.h / 2, screen.y);
    screenMesh.rotation.y = Math.PI;
    scene.add(screenMesh);
    const screenFrame = new THREE.LineSegments(
      new THREE.EdgesGeometry(screenMesh.geometry),
      new THREE.LineBasicMaterial({ color: 0xd7ff4f, transparent: true, opacity: 0.35 }),
    );
    screenFrame.position.copy(screenMesh.position);
    screenFrame.rotation.y = Math.PI;
    scene.add(screenFrame);

    // set pieces
    for (const piece of pack.setPieces) {
      if (piece.kind === "screen") continue;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(piece.w, piece.h, piece.d),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(piece.color), roughness: 0.85, metalness: 0.12 }),
      );
      mesh.position.set(piece.x, piece.z + piece.h / 2, piece.y);
      scene.add(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: 0xd7ff4f, transparent: true, opacity: 0.12 }),
      );
      edges.position.copy(mesh.position);
      scene.add(edges);
    }

    // trusses
    for (const truss of pack.rig.trusses) {
      if (truss.capacityKg <= 0) continue;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(truss.length, 0.13, 0.13),
        new THREE.MeshStandardMaterial({ color: 0x9aa093, roughness: 0.6, metalness: 0.5 }),
      );
      bar.position.set(0, truss.z, truss.y);
      scene.add(bar);
    }

    // fixtures + beams
    const lit = new Set(look.fixtureIds);
    const color = new THREE.Color(look.palette[0] ?? "#d7ff4f");
    pack.rig.fixtures.forEach((fixture, index) => {
      const on = lit.has(fixture.id);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.22),
        new THREE.MeshStandardMaterial({
          color: on ? color : new THREE.Color(0x303830),
          emissive: on ? color : new THREE.Color(0x000000),
          emissiveIntensity: on ? 1.4 : 0,
          roughness: 0.5,
        }),
      );
      body.position.set(fixture.x, fixture.z, fixture.y);
      scene.add(body);
      if (!on) return;
      const aim = index < look.audienceAim;
      const target = new THREE.Vector3(aim ? fixture.x * 0.3 : fixture.x * 0.4, aim ? 1.15 : 1.3, aim ? pack.stage.seats.firstRowY : 4.2);
      const from = new THREE.Vector3(fixture.x, fixture.z, fixture.y);
      const direction = target.clone().sub(from);
      const length = direction.length();
      if (length < 0.2) return;
      const radius = Math.tan((fixture.beamAngle * Math.PI) / 360) * length * 0.55;
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(0.08, radius), length, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color: aim && showGlare ? 0xff6b62 : color,
          transparent: true,
          opacity: aim && showGlare ? 0.14 : 0.09,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      beam.position.copy(from).add(direction.clone().multiplyScalar(0.5));
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize().negate());
      scene.add(beam);
    });

    // performers
    for (const performer of performersAt(pack, time)) {
      const isArtist = performer.role === "artist";
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(isArtist ? 0.2 : 0.16, isArtist ? 1.15 : 0.95, 4, 10),
        new THREE.MeshStandardMaterial({ color: isArtist ? 0xd7ff4f : 0x51e0d2, roughness: 0.6, emissive: isArtist ? 0x2a3a08 : 0x082a26, emissiveIntensity: 0.6 }),
      );
      body.position.set(performer.x, performer.z + (isArtist ? 1.0 : 0.85), performer.y);
      scene.add(body);
    }

    // audience: one instanced mesh, front row changes colour
    const seats = pack.stage.seats.rows * pack.stage.seats.perRow;
    const seatGeometry = new THREE.SphereGeometry(0.055, 6, 4);
    const seatMaterial = new THREE.MeshStandardMaterial({ color: 0x5a6555, roughness: 0.9 });
    const seatMesh = new THREE.InstancedMesh(seatGeometry, seatMaterial, seats);
    const matrix = new THREE.Matrix4();
    let index = 0;
    for (let row = 0; row < pack.stage.seats.rows; row++) {
      const z = pack.stage.seats.firstRowY - row * pack.stage.seats.gap;
      for (let column = 0; column < pack.stage.seats.perRow; column++) {
        const x = -pack.stage.width / 2 + 0.5 + (column / (pack.stage.seats.perRow - 1)) * (pack.stage.width - 1);
        matrix.setPosition(x, 0.6, z);
        seatMesh.setMatrixAt(index++, matrix);
      }
    }
    seatMesh.instanceMatrix.needsUpdate = true;
    scene.add(seatMesh);

    if (showGlare && look.audienceAim > 0) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 2.8, 48),
        new THREE.MeshBasicMaterial({ color: 0xff5c5c, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.02, pack.stage.seats.firstRowY);
      scene.add(ring);
    }

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      const w = element.clientWidth;
      const h = element.clientHeight || w * 0.62;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      screenTexture.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [look, pack, showGlare, Math.floor(time)]);

  if (failed) {
    return (
      <div className="stage3d stage3d-failed">
        <div>
          <div className="page-kicker">WebGL unavailable</div>
          <p className="small muted">The SVG previz is still here. Switch back to it; the show does not depend on a GPU.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stage3d" ref={host} role="img" aria-label={`3D previz of ${look.name} at ${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`}>
      <span className="stage3d-badge mono">WEBGL PREVIZ · drag to orbit</span>
    </div>
  );
}

function makeScreenTexture(pack: Pack, time: number, videoId: string | undefined): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const video = pack.videos.find((item) => item.id === videoId);
  if (!video) {
    ctx.fillStyle = "#0a0d0b";
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = "#d7ff4f";
    ctx.globalAlpha = 0.5;
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("N I G H T   S I G N A L", 512, 250);
    ctx.globalAlpha = 1;
  } else if (video.id === "vid-monolith") {
    ctx.fillStyle = "#f1ede2";
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = "#0a0c0b";
    ctx.fillRect(330, 110, 364, 330);
    ctx.strokeStyle = "#0a0c0b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 460);
    ctx.lineTo(1024, 460);
    ctx.stroke();
  } else if (video.id === "vid-rain") {
    ctx.fillStyle = "#080d12";
    ctx.fillRect(0, 0, 1024, 512);
    ctx.strokeStyle = "#6f8ba6";
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 70; i++) {
      const x = (i * 97 + time * 40) % 1024;
      const y = (i * 53 + time * 120) % 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 40);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (video.id === "vid-bars") {
    ctx.fillStyle = "#050a09";
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = i % 3 === 0 ? "#d7ff4f" : "#51e0d2";
      const h = 100 + ((i * 37) % 300);
      ctx.fillRect(30 + i * 40, 430 - h, 18, h);
    }
  } else {
    ctx.fillStyle = "#100c07";
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = "#ffb454";
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(512, 260, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ffb454";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 400);
    ctx.lineTo(1024, 400);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}
