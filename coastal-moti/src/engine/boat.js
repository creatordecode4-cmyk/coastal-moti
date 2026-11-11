import * as THREE from 'three';
import { angleDiff, clamp, damp } from './mathx.js';

// Dadaji's small sailing boat.
// Controls (same on every device): left / right steers, forward raises the sail, back rows backward.
//   - The sail only pulls when the wind is NOT in front: within about 40 degrees of the wind the boat
//     is "in irons" and only creeps forward on the oar. Fastest with the wind from the side.
//   - To go upwind the player must tack: zig-zag left and right of the wind.
//   - Letting go of the stick drops the sail: the boat slows and drifts (good for hiding in the dark).
// Headings are angles where (sin a, cos a) is the direction on the XZ plane. North is -Z.

const MAX_SPEED = 9.5;   // m/s on a beam reach in full wind
const OAR_SPEED = 1.5;   // m/s straight into the wind
const RADIUS = 1.3;
const MIN_DEPTH = -0.7;  // the hull needs this much water

// Speed factor for each angle off the wind (radians, 0 = pointing straight into it).
const POLAR = [[0, 0], [0.5, 0.04], [0.72, 0.5], [1.05, 0.8], [1.57, 1], [2.2, 0.95], [2.8, 0.8], [Math.PI, 0.72]];
export function sailPower(off) {
  for (let i = 1; i < POLAR.length; i++) {
    if (off <= POLAR[i][0]) {
      const [a0, v0] = POLAR[i - 1], [a1, v1] = POLAR[i];
      return v0 + (v1 - v0) * ((off - a0) / (a1 - a0));
    }
  }
  return POLAR[POLAR.length - 1][1];
}
export const sailZone = (off) => (off < 0.72 ? 'irons' : off < 1.2 ? 'close' : off < 2.4 ? 'reach' : 'run');

export function createBoat(game, { x, z, heading = Math.PI, windFrom = Math.PI }) {
  const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
  const root = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 3.4), lambert(0x6b4a2f));
  hull.position.y = 0.2;
  const prow = new THREE.Mesh(new THREE.ConeGeometry(0.76, 1.3, 4), lambert(0x6b4a2f));
  prow.rotation.x = Math.PI / 2; prow.rotation.y = Math.PI / 4; prow.position.set(0, 0.2, 2.3); prow.scale.y = 1; prow.scale.z = 0.36;
  const rim = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.1, 3.5), lambert(0x2f6f8f));
  rim.position.y = 0.5;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.6, 6), lambert(0x4a3824));
  mast.position.set(0, 2.2, 0.5);
  // Sail: a triangle hinged on the mast. It swings to the side away from the wind.
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 3.0, 0, 0, 0, -2.2], 3));
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, new THREE.MeshLambertMaterial({ color: 0xd8cfb4, side: THREE.DoubleSide }));
  const boom = new THREE.Group();
  boom.position.set(0, 0.9, 0.5);
  boom.add(sail);
  root.add(hull, prow, rim, mast, boom);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  game.scene.add(root);

  const pos = new THREE.Vector3(x, 0, z);
  const boat = { pos, root, heading, speed: 0, windFrom, active: true, sailUp: false, off: 0, power: 0 };
  let heel = 0, t = 0, sailAngle = 0;

  boat.forward = () => ({ x: Math.sin(boat.heading), z: Math.cos(boat.heading) });

  // Hull collision: stay in deep water, slide off rocks.
  function tryMove(dx, dz) {
    const { world } = game;
    let blocked = false;
    if (world.heightAt(pos.x + dx, pos.z) < MIN_DEPTH) pos.x += dx; else blocked = true;
    if (world.heightAt(pos.x, pos.z + dz) < MIN_DEPTH) pos.z += dz; else blocked = true;
    const bx = pos.x, bz = pos.z;
    world.resolveCircle(pos, RADIUS);
    if (Math.hypot(pos.x - bx, pos.z - bz) > 0.001) blocked = true;
    return blocked;
  }

  function place() {
    const f = boat.forward();
    const sea = game.engine.seaHeight;
    pos.y = sea(pos.x, pos.z);
    const pitch = Math.atan2(sea(pos.x + f.x * 1.5, pos.z + f.z * 1.5) - sea(pos.x - f.x * 1.5, pos.z - f.z * 1.5), 3);
    root.position.set(pos.x, pos.y + 0.05, pos.z);
    root.rotation.set(0, 0, 0);
    root.rotateY(boat.heading);
    root.rotateX(-pitch);
    root.rotateZ(heel);
    boom.rotation.y = sailAngle;
    // Veer sits in the boat.
    game.player.setPose(pos.x - f.x * 0.5, pos.y + 0.25, pos.z - f.z * 0.5, boat.heading);
  }

  boat.update = (dt) => {
    t += dt;
    const m = game.input.move();
    boat.sailUp = m.y > 0.25;

    // Where is the wind relative to the bow?
    const rel = angleDiff(boat.heading, boat.windFrom); // signed: + = wind on one side, - = the other
    boat.off = Math.abs(rel);
    boat.power = sailPower(boat.off);

    let target = 0;
    if (boat.sailUp) target = Math.max(MAX_SPEED * boat.power, OAR_SPEED);
    else if (m.y < -0.4) target = -OAR_SPEED;
    const rate = target < 0 ? 1.8 : target > boat.speed ? 0.9 : 0.55; // back-paddling brakes hard
    boat.speed += (target - boat.speed) * damp(rate, dt);

    // The rudder bites harder when the boat is moving.
    const turn = (0.5 + 0.7 * clamp(Math.abs(boat.speed) / 5, 0, 1)) * m.x;
    boat.heading -= turn * dt;

    const f = boat.forward();
    if (tryMove(f.x * boat.speed * dt, f.z * boat.speed * dt)) boat.speed *= 1 - Math.min(1, 3 * dt);

    // Looks: heel away from the wind, sail swings out; in irons it flaps.
    const side = rel >= 0 ? 1 : -1;
    heel += (side * 0.22 * boat.power * clamp(boat.speed / MAX_SPEED, 0, 1) * (boat.sailUp ? 1 : 0.2) - heel) * damp(3, dt);
    const flap = boat.sailUp && boat.power < 0.3 ? Math.sin(t * 22) * 0.25 : 0;
    const wantSail = boat.sailUp ? side * clamp(boat.off * 0.5, 0.12, 1.35) + flap : side * 0.1;
    sailAngle += (wantSail - sailAngle) * damp(5, dt);
    sail.scale.set(1, boat.sailUp ? 1 : 0.45, boat.sailUp ? 1 : 0.5);

    game.rig.autoYaw = boat.heading + Math.PI; // camera settles behind the boat
    place();
  };

  // Stop being the active vehicle (the boat stays where it is, e.g. pulled up on the beach).
  boat.park = () => { boat.active = false; boat.speed = 0; heel = 0; sail.scale.set(1, 0.45, 0.5); boat.sailUp = false; place(); };
  boat.dispose = () => {
    game.scene.remove(root);
    root.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  };

  place();
  return boat;
}
