import * as THREE from 'three';

// Damini's survey drone. It flies a fixed loop and paints a scanner circle on the ground.
// drone.touches(pos) is true while a point is inside the circle. The mission decides what that means.

const SPEED = 4.2, HEIGHT = 12;

export function createDrone(game, { route, radius = 5, start = 0 }) {
  const root = new THREE.Group();
  const shell = new THREE.MeshLambertMaterial({ color: 0x2b2e36 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), shell);
  root.add(body);
  for (const [x, z] of [[0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 10), new THREE.MeshBasicMaterial({ color: 0x8a8f99, transparent: true, opacity: 0.5 }));
    arm.position.set(x, 0.15, z); root.add(arm);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4fd8, fog: false }));
  eye.position.y = -0.2; root.add(eye);
  // Scanner: a ring and a faint disc on the ground, and a thin cone of light down from the drone.
  const scanMat = new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ringMat = scanMat.clone(); ringMat.opacity = 0.75;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 28).rotateX(-Math.PI / 2), scanMat);
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.22, radius, 36).rotateX(-Math.PI / 2), ringMat);
  const coneMat = scanMat.clone(); coneMat.opacity = 0.05;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, HEIGHT, 20, 1, true), coneMat);
  game.scene.add(root, disc, ring, cone);

  const first = route[start % route.length];
  const drone = { x: first.x, z: first.z, radius, active: true };
  let wp = (start + 1) % route.length, t = 0, leaving = 0;

  drone.touches = (p) => drone.active && Math.hypot(p.x - drone.x, p.z - drone.z) < radius;

  drone.update = (dt) => {
    t += dt;
    if (leaving > 0) {                     // called off: climb away
      leaving += dt;
      root.position.y += dt * 9; root.position.x += dt * 6;
      if (leaving > 4) root.visible = false;
      return;
    }
    const target = route[wp];
    const dx = target.x - drone.x, dz = target.z - drone.z, d = Math.hypot(dx, dz);
    if (d < 0.5) wp = (wp + 1) % route.length;
    else { drone.x += dx / d * SPEED * dt; drone.z += dz / d * SPEED * dt; }
    const y = game.world.heightAt(drone.x, drone.z);
    root.position.set(drone.x, y + HEIGHT + Math.sin(t * 2) * 0.3, drone.z);
    root.rotation.y += dt * 0.8;
    disc.position.set(drone.x, y + 0.12, drone.z);
    ring.position.set(drone.x, y + 0.14, drone.z);
    ring.scale.setScalar(1 - (Math.sin(t * 3) * 0.5 + 0.5) * 0.06);
    cone.position.set(drone.x, y + HEIGHT / 2, drone.z);
  };

  drone.leave = () => { drone.active = false; leaving = 0.01; disc.visible = ring.visible = cone.visible = false; };
  drone.dispose = () => {
    game.scene.remove(root, disc, ring, cone);
    root.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    for (const m of [disc, ring, cone]) { m.geometry.dispose(); m.material.dispose(); }
  };
  drone.update(0);
  return drone;
}
