'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  APPROACH,
  WORLD_ENTITIES,
  isWorldEntity,
  walkable,
  worldPath,
  type WorldEntity,
  type WorldPoint,
} from '@/lib/story-world';

type Props = {
  active: boolean;
  targets: string[];
  onReach: (target: string) => void;
  growth: number;
};
type Actions = {
  go: (id: WorldEntity) => void;
  stop: () => void;
  direction: (key: string, down: boolean) => void;
};
const directionKeys: Record<string, [number, number]> = {
  w: [-1, -1],
  ArrowUp: [-1, -1],
  s: [1, 1],
  ArrowDown: [1, 1],
  a: [-1, 1],
  ArrowLeft: [-1, 1],
  d: [1, -1],
  ArrowRight: [1, -1],
};
const buttonStyle: React.CSSProperties = {
  border: '2px solid #fff8de',
  borderRadius: 12,
  background: '#245943',
  color: '#fffbe9',
  fontSize: 13,
  fontWeight: 800,
  padding: '6px 10px',
  boxShadow: '0 3px 0 #153a2c',
  cursor: 'pointer',
};

export function StoryWorld3D(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    canvasHost = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const actions = useRef<Actions | null>(null);
  const [mode, setMode] = useState<'loading' | '3d' | 'fallback'>('loading');
  const [positions, setPositions] = useState<
    Partial<Record<WorldEntity, { left: number; top: number }>>
  >({});
  const [moving, setMoving] = useState(false);
  const targets = [...new Set(props.targets.filter(isWorldEntity))];
  const targetKey = targets.join('|');
  useEffect(() => {
    actions.current?.stop();
  }, [targetKey, props.active]);

  useEffect(() => {
    const element = host.current!,
      container = canvasHost.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#bce3d0');
    const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 80);
    camera.position.set(13, 15, 18);
    camera.lookAt(0, 0.7, 0);
    camera.updateMatrixWorld(true);
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      setMode('3d');
    } catch {
      setMode('fallback');
    }
    const materials = new Map<string, THREE.MeshStandardMaterial>();
    const material = (color: string) => {
      if (!materials.has(color))
        materials.set(
          color,
          new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }),
        );
      return materials.get(color)!;
    };
    function mesh(
      parent: THREE.Object3D,
      geometry: THREE.BufferGeometry,
      color: string,
      x: number,
      y: number,
      z: number,
    ) {
      const object = new THREE.Mesh(geometry, material(color));
      object.position.set(x, y, z);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      return object;
    }
    const box = (
      parent: THREE.Object3D,
      color: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => mesh(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z);
    const ball = (
      parent: THREE.Object3D,
      color: string,
      x: number,
      y: number,
      z: number,
      radius: number,
    ) => mesh(parent, new THREE.SphereGeometry(radius, 12, 8), color, x, y, z);
    const cylinder = (
      parent: THREE.Object3D,
      color: string,
      x: number,
      y: number,
      z: number,
      radius: number,
      height: number,
    ) => mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 10), color, x, y, z);
    const entity = (id: WorldEntity) => {
      const group = new THREE.Group();
      group.userData.target = id;
      scene.add(group);
      return group;
    };
    scene.add(new THREE.HemisphereLight('#fff9df', '#669478', 2.5));
    const light = new THREE.DirectionalLight('#fff5d4', 3.2);
    light.position.set(-5, 10, 5);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -9;
    light.shadow.camera.right = 9;
    light.shadow.camera.top = 9;
    light.shadow.camera.bottom = -9;
    light.shadow.camera.far = 30;
    light.shadow.normalBias = 0.035;
    scene.add(light);
    box(scene, '#7eae76', 0, -0.43, 0, 12.6, 0.8, 8.6);
    const ground = box(scene, '#b4d487', 0, -0.025, 0, 12.5, 0.08, 8.5);
    ground.userData.floor = true;
    box(scene, '#f5e7c1', -0.5, 0.025, 0.25, 11.5, 0.04, 1.15);
    box(scene, '#f5e7c1', -1, 0.027, 2, 1.3, 0.04, 3.8);
    box(scene, '#f5e7c1', 2.4, 0.025, 3.7, 6.5, 0.04, 0.7);
    // A real school volume, clay gable, yellow doorway, and generous windows.
    const school = entity('CLASSROOM');
    box(school, '#fff2cb', -2.8, 1.2, -2.2, 3.8, 2.4, 2.5);
    const roof = mesh(
      school,
      new THREE.CylinderGeometry(0, 2.35, 1.15, 4),
      '#cc7451',
      -2.8,
      2.9,
      -2.2,
    );
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.85;
    box(school, '#efbb45', -2.8, 0.72, -0.93, 0.8, 1.45, 0.1);
    ball(school, '#905532', -2.53, 0.72, -0.83, 0.055);
    for (const x of [-4.05, -1.5]) {
      box(school, '#78b7bf', x, 1.43, -0.9, 0.77, 0.85, 0.08);
      box(school, '#fffbea', x, 1.43, -0.84, 0.05, 0.9, 0.05);
      box(school, '#fffbea', x, 1.43, -0.83, 0.8, 0.05, 0.05);
    }
    box(school, '#a26445', -2.8, 2.14, -0.83, 1.4, 0.35, 0.09);
    // Pond rim, blue water, lily pads, and stepping stones.
    const pond = entity('POND');
    const rim = cylinder(pond, '#dfcba0', 3.5, 0.04, -2.1, 1.4, 0.16);
    rim.scale.z = 0.8;
    const water = cylinder(pond, '#6dc9c8', 3.5, 0.14, -2.1, 1.22, 0.06);
    water.scale.z = 0.8;
    for (const [x, z] of [
      [3, -2.3],
      [4, -1.8],
    ]) {
      cylinder(pond, '#519963', x, 0.19, z, 0.26, 0.035);
      ball(pond, '#fff1b9', x, 0.23, z, 0.09);
    }
    for (let i = 0; i < 5; i++) ball(pond, '#f5e2b5', 2.4 + i * 0.48, 0.11, -0.94, 0.13);
    const garden = entity('GARDEN'),
      sprouts: THREE.Group[] = [];
    box(garden, '#aa6e42', 3.25, 0.07, 2.1, 3.55, 0.12, 2.35);
    for (const z of [1.3, 2.1, 2.9]) box(garden, '#895b3f', 3.25, 0.14, z, 3.25, 0.13, 0.36);
    for (const z of [0.8, 3.4]) {
      box(garden, '#fff1c3', 3.25, 0.35, z, 4, 0.12, 0.09);
      for (let x = 1.35; x <= 5.25; x += 0.43) box(garden, '#fff3cf', x, 0.32, z, 0.12, 0.6, 0.12);
    }
    for (const x of [1.3, 5.3])
      for (const z of [1.2, 1.8, 2.4, 3]) box(garden, '#fff3cf', x, 0.32, z, 0.12, 0.6, 0.12);
    for (const x of [1.9, 2.75, 3.6, 4.45])
      for (const z of [1.3, 2.1, 2.9]) {
        const plant = new THREE.Group();
        plant.position.set(x, 0.19, z);
        garden.add(plant);
        sprouts.push(plant);
        cylinder(plant, '#44885b', 0, 0.25, 0, 0.035, 0.5);
        const leaf = ball(plant, '#64a451', -0.12, 0.22, 0, 0.15);
        leaf.scale.set(1.4, 0.4, 0.8);
        leaf.rotation.z = -0.5;
        const leaf2 = ball(plant, '#81b756', 0.13, 0.34, 0, 0.15);
        leaf2.scale.set(1.4, 0.4, 0.8);
        leaf2.rotation.z = 0.5;
        ball(plant, '#f5c956', 0, 0.56, 0, 0.11);
      }
    // Toys and story props retain distinct silhouettes even at the wide camera distance.
    const seeds = entity('SEEDS');
    box(seeds, '#f3cb5d', 1.6, 0.24, 3.7, 0.4, 0.45, 0.27);
    ball(seeds, '#72543b', 1.6, 0.24, 3.855, 0.065);
    const can = entity('WATERING_CAN');
    cylinder(can, '#579fa4', 4.7, 0.23, 0.2, 0.25, 0.42);
    const spout = cylinder(can, '#579fa4', 5, 0.31, 0.2, 0.08, 0.5);
    spout.rotation.z = -0.9;
    const handle = mesh(
      can,
      new THREE.TorusGeometry(0.23, 0.045, 6, 12),
      '#f7d367',
      4.45,
      0.35,
      0.2,
    );
    handle.rotation.y = Math.PI / 2;
    const book = entity('BOOK');
    box(book, '#d57861', -2.5, 0.17, -0.1, 0.57, 0.12, 0.4);
    box(book, '#fff4d8', -2.5, 0.18, -0.09, 0.52, 0.07, 0.37);
    const toy = entity('BALL');
    ball(toy, '#efbb45', -4, 0.24, 2.8, 0.24);
    const stripe = mesh(
      toy,
      new THREE.TorusGeometry(0.235, 0.025, 5, 16),
      '#fff7e4',
      -4,
      0.24,
      2.8,
    );
    stripe.rotation.x = 0.5;
    const shovel = entity('SHOVEL');
    box(shovel, '#ab754b', 0.8, 0.44, 3.1, 0.07, 0.76, 0.07);
    box(shovel, '#90b6ab', 0.8, 0.13, 3.1, 0.28, 0.25, 0.11);
    mesh(shovel, new THREE.TorusGeometry(0.12, 0.035, 5, 10), '#ab754b', 0.8, 0.87, 3.1);
    const sun = entity('SUN');
    ball(sun, '#ffd65b', -4.7, 4.9, -2.9, 0.53);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const ray = box(
        sun,
        '#ffe18a',
        -4.7 + Math.cos(a) * 0.76,
        4.9 + Math.sin(a) * 0.76,
        -2.9,
        0.1,
        0.25,
        0.1,
      );
      ray.rotation.z = a - Math.PI / 2;
    }
    for (const [x, z, size] of [
      [-5.45, -2.7, 1],
      [5.45, 2.8, 0.9],
      [-5.4, 0.2, 0.8],
      [0.5, -3.5, 0.8],
    ]) {
      cylinder(scene, '#926647', x, 0.65, z, 0.15, 1.3);
      for (const [dx, dy, dz] of [
        [0, 1.65, 0],
        [-0.32, 1.4, 0.15],
        [0.34, 1.4, 0],
      ])
        ball(scene, '#61935b', x + dx, dy * size, z + dz, 0.65 * size);
    }
    for (const [x, z] of [
      [-4.9, 3.5],
      [5.5, -0.4],
      [-0.1, 3.7],
    ]) {
      cylinder(scene, '#6c9d5a', x, 0.15, z, 0.22, 0.3);
      ball(scene, '#e8b167', x, 0.35, z, 0.13);
    }
    function character(id: 'XIAOYU' | 'AMIN' | 'TEACHER', color: string) {
      const group = entity(id),
        legs: THREE.Group[] = [];
      const p = WORLD_ENTITIES[id];
      group.position.set(p.x, 0.06, p.z);
      box(group, color, 0, 0.82, 0, 0.48, 0.65, 0.34);
      ball(group, '#efc7a0', 0, 1.4, 0, 0.3);
      const hair = ball(group, '#4a382f', 0, 1.54, -0.045, 0.3);
      hair.scale.y = 0.58;
      for (const x of [-0.105, 0.105]) {
        ball(group, '#352c29', x, 1.41, 0.271, 0.036);
        ball(group, '#f6a18b', x * 1.7, 1.31, 0.235, 0.046);
      }
      box(group, '#985a41', 0, 1.27, 0.282, 0.1, 0.025, 0.025);
      for (const x of [-0.31, 0.31]) {
        const arm = box(group, color, x, 0.8, 0, 0.14, 0.43, 0.17);
        arm.rotation.z = x > 0 ? 0.12 : -0.12;
        ball(group, '#efc7a0', x, 0.58, 0, 0.085);
      }
      for (const x of [-0.13, 0.13]) {
        const leg = new THREE.Group();
        leg.position.set(x, 0.52, 0);
        group.add(leg);
        legs.push(leg);
        box(leg, '#435d60', 0, -0.2, 0, 0.18, 0.4, 0.2);
        box(leg, '#fff4d7', 0, -0.4, 0.04, 0.2, 0.12, 0.3);
      }
      if (id === 'XIAOYU') box(group, '#f6c454', 0, 0.84, -0.25, 0.33, 0.4, 0.17);
      if (id === 'TEACHER')
        for (const x of [-0.105, 0.105])
          mesh(group, new THREE.TorusGeometry(0.075, 0.012, 5, 12), '#594c3f', x, 1.41, 0.288);
      return { group, legs };
    }
    const player = character('XIAOYU', '#66afbb');
    character('AMIN', '#d78261');
    character('TEACHER', '#87a36c');
    const position = { ...APPROACH.XIAOYU },
      keys = new Set<string>();
    let path: WorldPoint[] = [],
      pending: WorldEntity | null = null,
      frame = 0,
      previous = 0,
      stride = 0,
      isMoving = false,
      disposed = false,
      lost = false;
    const canMove = () => latest.current.active && !document.hidden;
    const updateMoving = (value: boolean) => {
      if (isMoving !== value) {
        isMoving = value;
        setMoving(value);
      }
      element.dataset.moving = String(value);
    };
    const stop = () => {
      keys.clear();
      path = [];
      pending = null;
      player.legs.forEach((leg) => {
        leg.rotation.x = 0;
      });
      updateMoving(false);
    };
    const go = (id: WorldEntity) => {
      if (!canMove() || !latest.current.targets.includes(id)) return;
      keys.clear();
      pending = id;
      path = worldPath(position, APPROACH[id]);
    };
    const direction = (key: string, down: boolean) => {
      if (!canMove()) return;
      if (down) {
        pending = null;
        path = [];
        keys.add(key);
      } else keys.delete(key);
    };
    actions.current = { go, stop, direction };
    function project() {
      const width = container.clientWidth,
        height = container.clientHeight;
      if (!width || !height) return;
      const aspect = width / height,
        halfHeight = Math.max(5.2, 8.5 / aspect);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      renderer?.setSize(width, height, false);
      const projected: Partial<Record<WorldEntity, { left: number; top: number }>> = {};
      for (const [id, p] of Object.entries(WORLD_ENTITIES)) {
        const screen = new THREE.Vector3(p.x, p.y, p.z).project(camera);
        projected[id as WorldEntity] = {
          left: ((screen.x + 1) * width) / 2,
          top: ((1 - screen.y) * height) / 2,
        };
      }
      setPositions(projected);
    }
    const resize = new ResizeObserver(project);
    resize.observe(container);
    project();
    const raycaster = new THREE.Raycaster();
    function pick(event: PointerEvent) {
      if (!canMove() || !renderer) return;
      element.focus({ preventScroll: true });
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          1 - ((event.clientY - rect.top) / rect.height) * 2,
        ),
        camera,
      );
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        let object: THREE.Object3D | null = hit.object;
        while (object && !object.userData.target) object = object.parent;
        const id = object?.userData.target;
        if (isWorldEntity(id) && latest.current.targets.includes(id)) {
          go(id);
          return;
        }
      }
      const floor = raycaster.intersectObject(ground)[0];
      if (floor) {
        keys.clear();
        pending = null;
        path = worldPath(position, { x: floor.point.x, z: floor.point.z });
      }
    }
    function keydown(event: KeyboardEvent) {
      if (
        !element.contains(document.activeElement) ||
        !canMove() ||
        (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))
      )
        return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (directionKeys[key]) {
        event.preventDefault();
        direction(key, true);
      }
      if (
        (key === 'e' || key === ' ') &&
        !event.repeat &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault();
        const nearest = latest.current.targets
          .filter(isWorldEntity)
          .sort(
            (a, b) =>
              Math.hypot(position.x - APPROACH[a].x, position.z - APPROACH[a].z) -
              Math.hypot(position.x - APPROACH[b].x, position.z - APPROACH[b].z),
          )[0];
        if (
          nearest &&
          Math.hypot(position.x - APPROACH[nearest].x, position.z - APPROACH[nearest].z) < 1.7
        )
          go(nearest);
      }
    }
    const keyup = (event: KeyboardEvent) =>
      keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      stop();
      cancelAnimationFrame(frame);
      previous = 0;
      setMode('fallback');
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      stop();
      cancelAnimationFrame(frame);
      previous = 0;
      if (!document.hidden && !disposed) frame = requestAnimationFrame(tick);
    };
    function tick(time: number) {
      if (disposed || document.hidden) return;
      const dt = Math.min((time - (previous || time)) / 1000, 0.05);
      previous = time;
      const oldX = position.x,
        oldZ = position.z;
      if (canMove()) {
        if (keys.size) {
          let dx = 0,
            dz = 0;
          keys.forEach((key) => {
            dx += directionKeys[key]?.[0] || 0;
            dz += directionKeys[key]?.[1] || 0;
          });
          const length = Math.hypot(dx, dz) || 1,
            step = dt * 2.7;
          if (walkable({ x: position.x + (dx / length) * step, z: position.z }))
            position.x += (dx / length) * step;
          if (walkable({ x: position.x, z: position.z + (dz / length) * step }))
            position.z += (dz / length) * step;
        } else if (path.length) {
          const target = path[0],
            dx = target.x - position.x,
            dz = target.z - position.z,
            distance = Math.hypot(dx, dz),
            step = dt * 2.7;
          if (distance <= step) {
            position.x = target.x;
            position.z = target.z;
            path.shift();
          } else {
            position.x += (dx / distance) * step;
            position.z += (dz / distance) * step;
          }
        }
        if (!path.length && pending) {
          const reached = pending;
          pending = null;
          if (
            latest.current.active &&
            latest.current.targets.includes(reached) &&
            Math.hypot(position.x - APPROACH[reached].x, position.z - APPROACH[reached].z) < 0.1
          )
            latest.current.onReach(reached);
        }
      } else stop();
      const travelled = Math.hypot(position.x - oldX, position.z - oldZ);
      updateMoving(travelled > 0.001);
      if (travelled > 0.001) {
        stride += travelled * 8;
        player.group.rotation.y = Math.atan2(position.x - oldX, position.z - oldZ);
      }
      player.legs.forEach((leg, index) => {
        leg.rotation.x = isMoving ? Math.sin(stride + index * Math.PI) * 0.5 : 0;
      });
      player.group.position.set(position.x, 0.06, position.z);
      element.dataset.x = position.x.toFixed(2);
      element.dataset.z = position.z.toFixed(2);
      const growth = Math.min(1, Math.max(0, latest.current.growth || 0));
      sprouts.forEach((plant) => plant.scale.setScalar(0.15 + growth * 0.85));
      if (!lost) renderer?.render(scene, camera);
      frame = requestAnimationFrame(tick);
    }
    renderer?.domElement.addEventListener('pointerdown', pick);
    renderer?.domElement.addEventListener('webglcontextlost', contextLost);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      actions.current = null;
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', visibility);
      renderer?.domElement.removeEventListener('pointerdown', pick);
      renderer?.domElement.removeEventListener('webglcontextlost', contextLost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      materials.forEach((value) => value.dispose());
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={host}
      data-story-world="school-garden"
      data-ready={mode !== 'loading'}
      data-render-mode={mode}
      data-moving={moving}
      tabIndex={0}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) actions.current?.stop();
      }}
      role="group"
      aria-label="学校花园。方向键或 WASD 行走，E 或空格与附近物品互动。"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 340,
        overflow: 'hidden',
        borderRadius: 24,
        background: '#bce3d0',
        outlineOffset: -4,
      }}
    >
      <div ref={canvasHost} style={{ position: 'absolute', inset: 0 }} />
      {mode === 'fallback' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: '24px 20px',
            background: '#e6efd8',
            color: '#245943',
          }}
        >
          <strong>这个设备暂时无法显示 3D 花园</strong>
          <p>
            仍可使用物品按钮继续故事。{moving ? '小雨正在走过去……' : '选一个物品，让小雨走过去。'}
          </p>
        </div>
      )}
      <div
        className="story3d-world-targets"
        aria-label="可探索的故事物品"
        style={
          mode === 'fallback'
            ? {
                position: 'absolute',
                left: 20,
                right: 20,
                top: 125,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
              }
            : { position: 'absolute', inset: 0, pointerEvents: 'none' }
        }
      >
        {targets.map((id) => (
          <button
            key={id}
            type="button"
            data-world-target={id}
            aria-label={`走向${WORLD_ENTITIES[id].label}`}
            disabled={!props.active || mode === 'loading'}
            onClick={() => actions.current?.go(id)}
            style={{
              ...buttonStyle,
              pointerEvents: 'auto',
              opacity: props.active ? 1 : 0.65,
              ...(mode !== 'fallback'
                ? {
                    position: 'absolute',
                    left: positions[id]?.left ?? -200,
                    top: positions[id]?.top ?? -200,
                    transform: 'translate(-50%, -100%)',
                  }
                : {}),
            }}
          >
            {WORLD_ENTITIES[id].label} <span aria-hidden="true">◇</span>
          </button>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 15,
          bottom: 14,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 34px)',
          gap: 4,
        }}
        aria-label="行走方向"
      >
        {(['', 'ArrowUp', '', 'ArrowLeft', 'ArrowDown', 'ArrowRight'] as const).map((key, i) =>
          key ? (
            <button
              key={key}
              type="button"
              aria-label={
                {
                  ArrowUp: '向上走',
                  ArrowDown: '向下走',
                  ArrowLeft: '向左走',
                  ArrowRight: '向右走',
                }[key]
              }
              disabled={!props.active}
              style={{ ...buttonStyle, padding: '7px 0', background: '#fff4d6', color: '#245943' }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                actions.current?.direction(key, true);
              }}
              onPointerUp={() => actions.current?.direction(key, false)}
              onPointerCancel={() => actions.current?.stop()}
              onLostPointerCapture={() => actions.current?.direction(key, false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  actions.current?.direction(key, true);
                }
              }}
              onKeyUp={() => actions.current?.direction(key, false)}
              onBlur={() => actions.current?.stop()}
            >
              {{ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[key]}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      <span
        style={{
          position: 'absolute',
          bottom: 15,
          right: 15,
          color: '#315940',
          background: '#fff8dea8',
          borderRadius: 9,
          padding: '5px 9px',
          fontSize: 11,
          pointerEvents: 'none',
        }}
      >
        点击地面行走 · 方向键 / WASD
      </span>
    </div>
  );
}
