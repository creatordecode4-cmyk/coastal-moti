import * as THREE from 'three';
import { lerpAngle, damp, clamp } from '../engine/mathx.js';

// Kaala Jaal speedboat with a searchlight.
//   patrol:  follows a fixed loop of waypoints while the light sweeps left and right ahead of it
//   chase:   the light held the player's boat for more than a second -> full speed at the player for a few seconds
//   search:  lost the player -> drifts for a moment, then goes back to the route
// boat.exposure goes 0 -> 1 while the light is on the player (1 second). Rocks block the light.
// boat.caught becomes true when a chasing boat reaches the player.

const SPOT_RADIUS = 9, SPOT_AHEAD = 17, SWEEP = 0.95, SWEEP_SPEED = 0.55;
// The chase is a little slower than Veer's boat on a reach (9.5 m/s): turning side-on to the wind
// outruns it, sailing close to the wind or sitting still does not.
const PATROL_SPEED = 5, CHASE_SPEED = 8.4, CHASE_TIME = 6, CATCH_RADIUS = 3.6;
const LIGHT_RANGE = 34;   // the light cannot hold a target further than this
const SEGS = 22;

export function createPatrolBoat(game, { route, start = 0, phase = 0 }) {
  const { world } = game;
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d24, flatShading: true });
  const root = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 5.6), dark); hull.position.y = 0.3;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.8), dark); cabin.position.set(0, 1.1, -0.6);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.14, 5.65), new THREE.MeshLambertMaterial({ color: 0x5c1f1f })); stripe.position.y = 0.55;
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampMat); lamp.position.set(0, 1.9, 0.2);
  root.add(hull, cabin, stripe, lamp);
  game.scene.add(root);

  // The pool of light on the water: a disc that follows the waves.
  const spotGeo = new THREE.BufferGeometry();
  const spotPos = new Float32Array((1 + SEGS * 2) * 3);
  const spotCol = new Float32Array((1 + SEGS * 2) * 3);
  spotGeo.setAttribute('position', new THREE.BufferAttribute(spotPos, 3));
  spotGeo.setAttribute('color', new THREE.BufferAttribute(spotCol, 3));
  const idx = [];
  for (let j = 0; j < SEGS; j++) {
    const a = 1 + j * 2, b = 1 + ((j + 1) % SEGS) * 2;
    idx.push(0, a, b, a, a + 1, b, a + 1, b + 1, b);
  }
  spotGeo.setIndex(idx);
  const spotMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, side: THREE.DoubleSide });
  const spotMesh = new THREE.Mesh(spotGeo, spotMat);
  spotMesh.frustumCulled = false;
  // The beam in the air, from the lamp down to the pool.
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 14, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2), beamMat);
  beam.frustumCulled = false;
  game.scene.add(spotMesh, beam);
  const calm = new THREE.Color(0xfff1c9), hot = new THREE.Color(0xff5a48), tint = new THREE.Color();

  const first = route[start % route.length];
  const pos = new THREE.Vector3(first.x, 0, first.z);
  const spot = new THREE.Vector3();
  const boat = { pos, spot, root, heading: 0, state: 'patrol', exposure: 0, lit: false, caught: false, spotRadius: SPOT_RADIUS };
  let wp = (start + 1) % route.length, sweepT = phase, chaseT = 0, lostT = 0, searchT = 0;
  boat.heading = Math.atan2(route[wp].x - pos.x, route[wp].z - pos.z);
  let lightAngle = boat.heading;

  function steer(tx, tz, speed, dt) {
    const dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz);
    if (d > 0.01) boat.heading = lerpAngle(boat.heading, Math.atan2(dx, dz), damp(2.2, dt));
    const step = Math.min(d, speed * dt);
    pos.x += Math.sin(boat.heading) * step;
    pos.z += Math.cos(boat.heading) * step;
    world.resolveCircle(pos, 1.6);
    return d;
  }

  boat.update = (dt, target) => {
    const sea = game.engine.seaHeight;
    const dx = target.x - pos.x, dz = target.z - pos.z, dist = Math.hypot(dx, dz);
    const sight = dist < LIGHT_RANGE && world.lineOfSight(pos.x, pos.z, target.x, target.z);

    if (boat.state === 'patrol') {
      const t = route[wp];
      if (steer(t.x, t.z, PATROL_SPEED, dt) < 2.5) wp = (wp + 1) % route.length;
      sweepT += dt * SWEEP_SPEED;
      lightAngle = boat.heading + Math.sin(sweepT) * SWEEP;
      spot.set(pos.x + Math.sin(lightAngle) * SPOT_AHEAD, 0, pos.z + Math.cos(lightAngle) * SPOT_AHEAD);
    } else if (boat.state === 'chase') {
      chaseT -= dt;
      if (sight) {                       // the light stays locked on while it can see the player
        lostT = 0;
        spot.x += (target.x - spot.x) * damp(6, dt); spot.z += (target.z - spot.z) * damp(6, dt);
        steer(target.x, target.z, CHASE_SPEED, dt);
        if (dist < CATCH_RADIUS) boat.caught = true;
      } else {                           // behind a rock or too far: keep going where they were last seen
        lostT += dt;
        steer(spot.x, spot.z, CHASE_SPEED * 0.7, dt);
      }
      if (chaseT <= 0 || lostT > 2.2) { boat.state = 'search'; searchT = 2.5; boat.exposure = 0; }
    } else {                             // search: slow circle of light, then back to the route
      searchT -= dt;
      sweepT += dt * 2;
      spot.x += Math.cos(sweepT) * 4 * dt; spot.z += Math.sin(sweepT) * 4 * dt;
      if (searchT <= 0) boat.state = 'patrol';
    }

    // Is the player's boat inside the pool of light, with nothing in the way?
    boat.lit = Math.hypot(target.x - spot.x, target.z - spot.z) < SPOT_RADIUS && sight;
    if (boat.state === 'patrol' || boat.state === 'search') {
      boat.exposure = clamp(boat.exposure + (boat.lit ? 1 : -0.7) * dt, 0, 1);
      if (boat.exposure >= 1) { boat.state = 'chase'; chaseT = CHASE_TIME; lostT = 0; boat.justAlerted = true; }
    }
    draw(sea);
  };

  function draw(sea) {
    pos.y = sea(pos.x, pos.z);
    root.position.set(pos.x, pos.y, pos.z);
    root.rotation.y = boat.heading;
    const heat = boat.state === 'chase' ? 1 : boat.exposure;
    tint.copy(calm).lerp(hot, heat);
    const centre = 0.42 - heat * 0.14, edge = 0.16 - heat * 0.05; // a red pool reads strongly: dim it a little
    spotPos.set([spot.x, sea(spot.x, spot.z) + 0.14, spot.z], 0);
    spotCol.set([tint.r * centre, tint.g * centre, tint.b * centre], 0);
    for (let j = 0; j < SEGS; j++) {
      const a = (j / SEGS) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (let k = 0; k < 2; k++) {
        const r = SPOT_RADIUS * (k ? 1 : 0.55), x = spot.x + c * r, z = spot.z + s * r;
        const i = (1 + j * 2 + k) * 3, v = k ? 0 : edge * 2;
        spotPos[i] = x; spotPos[i + 1] = sea(x, z) + 0.14; spotPos[i + 2] = z;
        spotCol[i] = tint.r * (k ? edge : v + 0.05); spotCol[i + 1] = tint.g * (k ? edge : v + 0.05); spotCol[i + 2] = tint.b * (k ? edge : v + 0.05);
      }
    }
    spotGeo.attributes.position.needsUpdate = true;
    spotGeo.attributes.color.needsUpdate = true;
    // Beam: a cone from the lamp to the pool.
    const lx = pos.x, ly = pos.y + 1.9, lz = pos.z;
    beam.position.set(lx, ly, lz);
    beam.lookAt(spot.x, 0.2, spot.z);
    const len = Math.hypot(spot.x - lx, ly, spot.z - lz);
    beam.scale.set(SPOT_RADIUS * 0.9, SPOT_RADIUS * 0.9, len);
    beamMat.color.copy(tint);
  }

  boat.dispose = () => {
    game.scene.remove(root, spotMesh, beam);
    for (const o of [hull, cabin, stripe, lamp, spotMesh, beam]) { o.geometry.dispose(); o.material.dispose(); }
  };

  spot.set(pos.x + Math.sin(boat.heading) * SPOT_AHEAD, 0, pos.z + Math.cos(boat.heading) * SPOT_AHEAD);
  draw(game.engine.seaHeight);
  return boat;
}
