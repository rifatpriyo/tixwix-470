"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Seat } from "@/lib/reservations";
export default function SeatPreview({
  seat,
  seats,
}: {
  seat: Seat;
  seats: Seat[];
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = mount.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      const failure = setTimeout(() => setFailed(true), 0);
      return () => clearTimeout(failure);
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#111827");
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
    camera.position.set(
      (seat.seat_number - (seat.columns + 1) / 2) * 1.1,
      1.6 + seat.row_index * 0.12,
      4 + seat.row_index * 1.5,
    );
    camera.lookAt(0, 1.3, -2);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 3));
    const meshes: THREE.Mesh[] = [];
    function box(
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      color: string,
    ) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color }),
      );
      mesh.position.set(x, y, z);
      scene.add(mesh);
      meshes.push(mesh);
    }
    box(24, 0.1, 30, 0, -0.1, 6, "#374151");
    box(10, 0.8, 4, 0, 0.4, -2, "#a16207");
    box(12, 6, 0.2, 0, 3, -4.2, "#7f1d1d");
    box(0.35, 2, 0.35, 0, 1.8, -1, "#e5e7eb");
    for (const s of seats)
      box(
        0.8,
        0.8,
        0.7,
        (s.seat_number - (s.columns + 1) / 2) * 1.1,
        0.4 + s.row_index * 0.12,
        4 + s.row_index * 1.5,
        "#2563eb",
      );
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      `Approximate stage view from ${seat.label}`,
    );
    const resize = () => {
      const width = element.clientWidth;
      renderer.setSize(width, 320);
      camera.aspect = width / 320;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const lost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.dispose();
      renderer.forceContextLoss();
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      renderer.domElement.remove();
    };
  }, [seat, seats]);
  return (
    <div>
      <p className="my-3 text-sm">
        Approximate audience view from {seat.section} {seat.label}. This model
        illustrates the demo hall; sightlines may vary.
      </p>
      {failed ? (
        <p role="status">
          3D is unavailable on this device. You can still choose seats using the
          map.
        </p>
      ) : (
        <div ref={mount} className="overflow-hidden rounded-lg" />
      )}
    </div>
  );
}
