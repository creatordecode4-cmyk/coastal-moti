import * as THREE from 'three';

// Neelu, the kingfisher. He shows WHERE to look next, like a living objective marker:
// he flies to a spot and hovers or perches there. He never shows HOW to solve anything.
//   neelu.goTo({ x, z }, height)   fly there and stay `height` metres above the ground

const SPEED = 11;

export function createNeelu(game, { x, z }) {
  const blue = new THREE.MeshLambertMaterial({ color: 0x1f8fd6, flatShading: true });
  const orange = new THREE.MeshLambertMaterial({ color: 0xf08a2c, flatShading: true });
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), blue); body.scale.set(0.8, 0.85, 1.25);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), orange); belly.position.set(0, -0.07, 0.06); belly.scale.set(0.8, 0.7, 1.1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), blue); head.position.set(0, 0.14, 0.24);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.34, 6), new THREE.MeshLambertMaterial({ color: 0x22252b })); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.12, 0.5);
  const wingGeo = new THREE.BoxGeometry(0.5, 0.03, 0.28);
  const wingL = new THREE.Group(), wingR = new THREE.Group();
  const wl = new THREE.Mesh(wingGeo, blue); wl.position.x = 0.25; wingL.add(wl); wingL.position.set(0.12, 0.05, 0);
  const wr = new THREE.Mesh(wingGeo, blue); wr.position.x = -0.25; wingR.add(wr); wingR.position.set(-0.12, 0.05, 0);
  root.add(body, belly, head, beak, wingL, wingR);
  root.scale.setScalar(1.5);                 // a little larger than life so he reads on a phone
  game.scene.add(root);

  const pos = new THREE.Vector3(x, game.world.heightAt(x, z) + 3, z);
  const neelu = { pos, target: { x, z }, height: 3, arrived: false };
  let t = 0;

  neelu.goTo = (p, height = 3) => { neelu.target = { x: p.x, z: p.z }; neelu.height = height; };

  neelu.update = (dt) => {
    t += dt;
    const ty = game.world.heightAt(neelu.target.x, neelu.target.z) + neelu.height;
    const dx = neelu.target.x - pos.x, dy = ty - pos.y, dz = neelu.target.z - pos.z;
    const d = Math.hypot(dx, dy, dz);
    neelu.arrived = d < 0.4;
    if (!neelu.arrived) {
      const step = Math.min(d, SPEED * dt);
      pos.x += dx / d * step; pos.y += dy / d * step; pos.z += dz / d * step;
      root.rotation.y = Math.atan2(dx, dz);
    }
    root.position.set(pos.x, pos.y + Math.sin(t * 3) * 0.12, pos.z);
    const flap = Math.sin(t * (neelu.arrived ? 14 : 26)) * (neelu.arrived ? 0.35 : 0.9);
    wingL.rotation.z = flap; wingR.rotation.z = -flap;
  };

  neelu.dispose = () => { game.scene.remove(root); root.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); };
  neelu.update(0);
  return neelu;
}
