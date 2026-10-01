/* ==========================================================
   TEAM AANYA — 3D hangar walk-through
   Scrolling walks the camera down a wireframe hall. Screens hang
   along the walls playing test footage; the rover stands at the
   entrance as a point cloud. Needs three.js (assets/js/vendor).
   ========================================================== */
(() => {
  "use strict";
  const section = document.getElementById("hangar");
  const canvas = document.getElementById("hangarCanvas");
  if (!section || !canvas || !window.THREE) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    document.body.classList.add("no-hangar");
    return;
  }
  document.body.classList.add("has-hangar");

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TEAL = 0x4fd3d6, WHITE = 0xe9eef3;

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 8, 52);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

  /* ---------- hall geometry ---------- */
  const HALL_W = 8, HALL_H = 9, Z0 = 14, Z1 = -112;
  const lineMat = new THREE.LineBasicMaterial({ color: WHITE, transparent: true, opacity: 0.42 });
  const faintMat = new THREE.LineBasicMaterial({ color: WHITE, transparent: true, opacity: 0.12 });
  function lines(pts, mat = lineMat) {
    const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p)));
    const l = new THREE.LineSegments(g, mat);
    scene.add(l);
    return l;
  }
  const seg = [];
  // long edges
  for (const x of [-HALL_W, HALL_W]) for (const y of [0, HALL_H]) seg.push([x, y, Z0], [x, y, Z1]);
  // portal frames + roof trusses every 8 units
  for (let z = Z0 - 4; z > Z1; z -= 8) {
    seg.push([-HALL_W, 0, z], [-HALL_W, HALL_H, z], [HALL_W, 0, z], [HALL_W, HALL_H, z], [-HALL_W, HALL_H, z], [HALL_W, HALL_H, z]);
    seg.push([-HALL_W, HALL_H, z], [0, HALL_H + 2.6, z], [0, HALL_H + 2.6, z], [HALL_W, HALL_H, z]);
    seg.push([-HALL_W * 0.5, HALL_H + 1.3, z], [-HALL_W * 0.5, HALL_H, z], [HALL_W * 0.5, HALL_H + 1.3, z], [HALL_W * 0.5, HALL_H, z]);
    // tall window outlines on the walls
    for (const x of [-HALL_W, HALL_W]) seg.push([x, 1.2, z - 2], [x, 6.5, z - 2], [x, 6.5, z - 2], [x, 6.5, z - 6], [x, 6.5, z - 6], [x, 1.2, z - 6], [x, 1.2, z - 6], [x, 1.2, z - 2]);
  }
  seg.push([0, HALL_H + 2.6, Z0], [0, HALL_H + 2.6, Z1]);
  lines(seg);
  // floor grid
  const grid = [];
  for (let z = Z0; z > Z1; z -= 2) grid.push([-HALL_W, 0, z], [HALL_W, 0, z]);
  for (let x = -HALL_W; x <= HALL_W; x += 2) grid.push([x, 0, Z0], [x, 0, Z1]);
  lines(grid, faintMat);

  // hanging bulbs
  const bulbGeo = new THREE.SphereGeometry(0.09, 12, 12);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const wires = [];
  for (let z = Z0 - 8; z > Z1; z -= 11) {
    const x = (z % 3) * 1.6, y = 4.2 + ((z * 7) % 3);
    const b = new THREE.Mesh(bulbGeo, bulbMat); b.position.set(x, y, z); scene.add(b);
    wires.push([x, y, z], [x, HALL_H + 2, z]);
  }
  lines(wires, faintMat);

  // soft light pools on the floor
  function glowTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = glowTexture();
  for (let z = Z0 - 6; z > Z1; z -= 9) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }));
    m.rotation.x = -Math.PI / 2; m.position.set(((z * 13) % 5) - 2, 0.01, z); scene.add(m);
  }

  /* ---------- point clouds ---------- */
  function pointsFrom(fill, n, color, size) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const p = fill(Math.random); pos.set(p, i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  }
  // rover: chassis, six wheels on legs, mast arm with gripper
  const W = [[-2.4, -1.7], [-2.6, 0], [-2.4, 1.7], [2.4, -1.7], [2.6, 0], [2.4, 1.7]];
  const rover = pointsFrom((r) => {
    const k = r();
    if (k < 0.42) { // chassis surface
      const f = Math.floor(r() * 3), a = r() * 2 - 1, b = r() * 2 - 1, s = r() < 0.5 ? -1 : 1;
      const v = f === 0 ? [s * 1.6, a * 0.55, b * 1.1] : f === 1 ? [a * 1.6, s * 0.55, b * 1.1] : [a * 1.6, b * 0.55, s * 1.1];
      return [v[0], v[1] + 2.0, v[2]];
    }
    if (k < 0.78) { // wheels
      const w = W[Math.floor(r() * 6)], t = r() * Math.PI * 2, rr = 0.42 + r() * 0.12, d = (r() - 0.5) * 0.36;
      return [w[0] + d, 0.55 + Math.sin(t) * rr, w[1] + Math.cos(t) * rr];
    }
    if (k < 0.9) { // legs
      const w = W[Math.floor(r() * 6)], t = r(), sx = Math.sign(w[0]);
      return [sx * 1.6 + (w[0] - sx * 1.6) * t, 2.0 - t * 0.9 + Math.sin(t * Math.PI) * 0.5, w[1] * t];
    }
    const t = r(); // arm
    if (t < 0.5) return [0.9 + (r() - 0.5) * 0.12, 2.55 + t * 2 * 2.4, 0.3 + (r() - 0.5) * 0.12];
    if (t < 0.85) { const u = (t - 0.5) / 0.35; return [0.9 + u * 1.6, 4.95 + u * 0.3, 0.3 + (r() - 0.5) * 0.1]; }
    return [2.5 + r() * 0.35, 5.0 + (r() - 0.5) * 0.4, 0.3 + (r() - 0.5) * 0.4];
  }, 9000, TEAL, 0.045);
  const roverGroup = new THREE.Group(); roverGroup.add(rover); roverGroup.position.set(0, 0, 2); scene.add(roverGroup);

  // Swap the sketch for a point cloud sampled from the real CAD model, when it loads.
  if (THREE.GLTFLoader) {
    const gl = new THREE.GLTFLoader();
    if (window.MeshoptDecoder) gl.setMeshoptDecoder(window.MeshoptDecoder);
    gl.load("assets/model/aanya.glb", (gltf) => {
      const m = gltf.scene; m.updateMatrixWorld(true);
      // Sample points evenly over the surface area, so flat panels show up as well as detailed parts.
      const tris = [], area = [];
      let total = 0;
      const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
      m.traverse((o) => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position, idx = o.geometry.index;
        const count = idx ? idx.count : pos.count;
        for (let i = 0; i < count; i += 3) {
          const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
          A.fromBufferAttribute(pos, ia).applyMatrix4(o.matrixWorld);
          B.fromBufferAttribute(pos, ib).applyMatrix4(o.matrixWorld);
          C.fromBufferAttribute(pos, ic).applyMatrix4(o.matrixWorld);
          const ar = t1.subVectors(B, A).cross(t2.subVectors(C, A)).length() / 2;
          if (ar <= 0) continue;
          tris.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z);
          total += ar; area.push(total);
        }
      });
      const keep = 18000, out = new Float32Array(keep * 3), box = new THREE.Box3();
      for (let i = 0; i < keep; i++) {
        const r = Math.random() * total;
        let lo = 0, hi = area.length - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (area[mid] < r) lo = mid + 1; else hi = mid; }
        let u = Math.random(), w = Math.random();
        if (u + w > 1) { u = 1 - u; w = 1 - w; }
        const k = lo * 9;
        for (let d = 0; d < 3; d++) out[i * 3 + d] = tris[k + d] + u * (tris[k + 3 + d] - tris[k + d]) + w * (tris[k + 6 + d] - tris[k + d]);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(out, 3));
      box.setFromBufferAttribute(g.attributes.position);
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const s = 5.4 / Math.max(size.x, size.z);
      g.translate(-c.x, -box.min.y, -c.z); g.scale(s, s, s);
      rover.geometry.dispose(); rover.geometry = g; rover.material.size = 0.035;
    });
  }

  // floor ring under the rover
  const ringGeo = new THREE.RingGeometry(3.8, 3.86, 96);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, 2); scene.add(ring);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, 96), new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  pulse.rotation.x = -Math.PI / 2; pulse.position.copy(ring.position); scene.add(pulse);

  // visitors, as point clouds, watching the screens
  function person(x, z) {
    const p = pointsFrom((r) => {
      if (r() < 0.2) { const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1); return [Math.sin(v) * Math.cos(u) * 0.2, 1.72 + Math.cos(v) * 0.22, Math.sin(v) * Math.sin(u) * 0.2]; }
      const y = r() * 1.5, rad = y > 0.75 ? 0.28 : 0.2 + (y / 0.75) * 0.06, a = r() * Math.PI * 2;
      return [Math.cos(a) * rad * (y < 0.75 ? 0.75 : 1) + (y < 0.75 ? (r() < 0.5 ? -0.12 : 0.12) : 0), y, Math.sin(a) * rad * 0.6];
    }, 1400, WHITE, 0.03);
    p.material.opacity = 0.65; p.position.set(x, 0, z); scene.add(p); return p;
  }
  const people = [person(-2.2, -18), person(2.8, -38), person(-1.2, -60), person(2, -82)];

  /* ---------- floating outline words ---------- */
  const words = [];
  function word(text, x, y, z, h = 1.6, ry = 0) {
    const c = document.createElement("canvas"), g = c.getContext("2d");
    const fs = 160; g.font = `700 ${fs}px "Chakra Petch", "Arial Black", sans-serif`;
    c.width = Math.ceil(g.measureText(text).width + 40); c.height = fs + 40;
    g.font = `700 ${fs}px "Chakra Petch", "Arial Black", sans-serif`; g.textBaseline = "middle";
    g.lineWidth = 3; g.strokeStyle = "rgba(233,238,243,0.9)"; g.strokeText(text, 20, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(h * c.width / c.height, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.55 }));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); words.push(m); return m;
  }

  /* ---------- screens ---------- */
  const screens = [];
  const loader = new THREE.TextureLoader();
  function screen({ x, z, w = 6.4, label, sub, video, image, side }) {
    const h = w * 9 / 16, y = 4.1;
    let tex, vid = null;
    if (video) {
      vid = document.createElement("video");
      Object.assign(vid, { src: video, muted: true, loop: true, playsInline: true, preload: "none" });
      vid.setAttribute("muted", ""); vid.setAttribute("playsinline", "");
      tex = new THREE.VideoTexture(vid);
    } else tex = loader.load(image);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const g = new THREE.Group(); g.add(mesh);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w + 0.25, h + 0.25)), new THREE.LineBasicMaterial({ color: WHITE, transparent: true, opacity: 0.7 }));
    g.add(frame);
    // label plate under the screen
    const c = document.createElement("canvas"); c.width = 512; c.height = 96; const k = c.getContext("2d");
    k.fillStyle = "rgba(0,0,0,0.55)"; k.fillRect(0, 0, 512, 96); k.fillStyle = "#4fd3d6"; k.fillRect(0, 0, 6, 96);
    k.fillStyle = "#e9eef3"; k.font = '700 40px "Chakra Petch", sans-serif'; k.fillText(label, 22, 46);
    k.fillStyle = "rgba(200,215,225,0.85)"; k.font = '600 20px "JetBrains Mono", monospace'; k.fillText(sub, 24, 80);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.525), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    plate.position.set(-w / 2 + 1.4, -h / 2 - 0.55, 0.01); g.add(plate);
    g.position.set(x, y, z);
    g.rotation.y = side === "left" ? 0.42 : side === "right" ? -0.42 : 0;
    scene.add(g);
    // hanging wires
    const tl = new THREE.Vector3(-w / 2, h / 2, 0).applyMatrix4(g.matrixWorld.compose(g.position, g.quaternion, g.scale));
    const tr = new THREE.Vector3(w / 2, h / 2, 0).applyMatrix4(g.matrixWorld);
    lines([[tl.x, tl.y, tl.z], [tl.x * 0.6, HALL_H + 1.2, tl.z], [tr.x, tr.y, tr.z], [tr.x * 0.6, HALL_H + 1.2, tr.z]], faintMat);
    const s = { group: g, mesh, frame, vid, label, video, image, z };
    mesh.userData.screen = s; screens.push(s);
    return s;
  }

  // Stations along the hall: [z, tab id, title, description]
  const STATIONS = [
    { z: 8, tab: "rover", title: "The machine", text: "AANYA: a 6WD skid-steer rover with a multi-axis arm and an NVIDIA Jetson edge-AI brain." },
    { z: -20, tab: "action", title: "In action", text: "Real test footage. Click a screen to play it full size." },
    { z: -42, tab: "action", title: "The arm", text: "Servo-driven manipulator on a PCA9685 over I2C, with a gripper and camera." },
    { z: -64, tab: "control", title: "Mission control", text: "Our in-house dashboard: camera, LiDAR scan, telemetry and gamepad overdrive." },
    { z: -86, tab: "build", title: "CAD to concrete", text: "Designed in Autodesk Fusion, built by hand: rocker-bogie suspension, aluminium frame." },
    { z: -104, tab: "enter", title: "Enter", text: "Keep scrolling to take the rover apart in 3D, then meet the team." },
  ];

  // the door at the end of the hall
  lines([[-2, 0, -110], [-2, 5.4, -110], [-2, 5.4, -110], [2, 5.4, -110], [2, 5.4, -110], [2, 0, -110], [-1.7, 0, -110], [-1.7, 5.1, -110], [-1.7, 5.1, -110], [1.7, 5.1, -110], [1.7, 5.1, -110], [1.7, 0, -110]]);
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 }));
  doorGlow.position.set(0, 2.55, -110.05); scene.add(doorGlow);

  /* ---------- UI ---------- */
  const ui = {
    intro: document.getElementById("hangarIntro"),
    title: document.getElementById("hangarStation"),
    text: document.getElementById("hangarText"),
    bar: document.getElementById("hangarBar"),
    hover: document.getElementById("hangarHover"),
    tabs: [...document.querySelectorAll("[data-hangar-tab]")],
  };
  const CAM_START = Z0 - 2, CAM_END = -101;
  const zToProgress = (z) => (CAM_START - z) / (CAM_START - CAM_END);
  ui.tabs.forEach((b) => b.addEventListener("click", () => {
    const st = STATIONS.find((s) => s.tab === b.dataset.hangarTab);
    if (!st) return;
    const p = Math.min(1, Math.max(0, zToProgress(st.z + 9)));
    const top = section.offsetTop + p * (section.offsetHeight - innerHeight);
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }));

  /* ---------- input ---------- */
  let target = 0, prog = 0, visible = false;
  const mouse = new THREE.Vector2(0, 0), look = new THREE.Vector2(0, 0), ndc = new THREE.Vector2(-9, -9);
  function readScroll() {
    const r = section.getBoundingClientRect();
    const span = section.offsetHeight - innerHeight;
    target = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
  }
  addEventListener("scroll", readScroll, { passive: true });
  addEventListener("resize", resize);
  section.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
    ndc.copy(mouse);
  });
  section.addEventListener("pointerleave", () => ndc.set(-9, -9));
  const ray = new THREE.Raycaster();
  let hovered = null;
  canvas.addEventListener("click", () => {
    if (!hovered) return;
    if (hovered.video && window.aanyaOpenVideo) window.aanyaOpenVideo(hovered.video);
    else if (hovered.image && window.aanyaOpenImage) window.aanyaOpenImage(hovered.image, hovered.label);
  });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 78 : 60;
    camera.updateProjectionMatrix();
    // Desktop: rover stands to the right of the intro title; phones: centred, further back.
    const narrow = camera.aspect < 1;
    roverGroup.position.set(narrow ? 0 : 3.2, 0, narrow ? -1 : 2);
    ring.position.set(roverGroup.position.x, 0.02, roverGroup.position.z);
    pulse.position.copy(ring.position);
    readScroll();
  }

  new IntersectionObserver((en) => {
    visible = en[0].isIntersecting;
    screens.forEach((s) => s.vid && !visible && s.vid.pause());
  }).observe(section);

  /* ---------- loop ---------- */
  let last = performance.now(), stationIdx = -1, lastAudioProg = -1;
  function frame(t) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min((t - last) / 1000, 0.05); last = t;
    prog += (target - prog) * (reduced ? 1 : Math.min(1, dt * 4));
    look.lerp(mouse, Math.min(1, dt * 3));

    const z = CAM_START + (CAM_END - CAM_START) * prog;
    camera.position.set(Math.sin(prog * 9) * 0.6, 2.3 + Math.sin(t / 900) * 0.04, z);
    camera.rotation.set(look.y * 0.12, -look.x * 0.32 + Math.sin(prog * 9) * 0.04, 0, "YXZ");

    roverGroup.rotation.y = reduced ? 0.6 : t / 6000;
    const pp = ((t / 2600) % 1);
    pulse.scale.setScalar(1 + pp * 5); pulse.material.opacity = 0.6 * (1 - pp);
    people.forEach((p, i) => (p.material.opacity = 0.45 + 0.2 * Math.sin(t / 700 + i)));

    // only play footage near the camera
    screens.forEach((s) => {
      if (!s.vid) return;
      const near = Math.abs(s.z - z) < 34;
      if (near && s.vid.paused) { s.vid.preload = "auto"; s.vid.play().catch(() => {}); }
      else if (!near && !s.vid.paused) s.vid.pause();
    });

    // hover a screen
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(screens.map((s) => s.mesh))[0];
    const h = hit ? hit.object.userData.screen : null;
    if (h !== hovered) {
      if (hovered) hovered.frame.material.color.set(WHITE);
      hovered = h;
      if (hovered) hovered.frame.material.color.set(TEAL);
      canvas.style.cursor = hovered ? "pointer" : "";
      ui.hover.textContent = hovered ? `▶ ${hovered.video ? "Play" : "View"} · ${hovered.label}` : "";
      ui.hover.hidden = !hovered;
    }

    // HUD
    ui.intro.style.opacity = String(Math.max(0, 1 - prog * 14));
    ui.intro.style.pointerEvents = prog > 0.06 ? "none" : "";
    ui.bar.style.transform = `scaleY(${prog})`;
    if (window.aanyaAudio && Math.abs(prog - lastAudioProg) > 0.01) { lastAudioProg = prog; window.aanyaAudio.setProgress(prog); }
    let idx = 0;
    STATIONS.forEach((s, i) => { if (z < s.z + 17) idx = i; });
    if (idx !== stationIdx) {
      stationIdx = idx;
      const s = STATIONS[idx];
      ui.title.textContent = `${String(idx + 1).padStart(2, "0")} · ${s.title}`;
      ui.text.textContent = s.text;
      ui.tabs.forEach((b) => b.classList.toggle("is-on", b.dataset.hangarTab === s.tab));
    }
    renderer.render(scene, camera);
  }

  const start = () => { resize(); requestAnimationFrame(frame); };
  // Wait for web fonts so the canvas-drawn words use Chakra Petch.
  function buildContent() {
  word("AANYA", 0, 7.2, -6, 2.4);
  word("IN ACTION", 0, 7.4, -30, 1.7);
  word("MISSION CONTROL", 0, 7.4, -70, 1.4);
  word("BUILD", 0, 7.4, -92, 1.7);
  word("ENTER", 0, 3.4, -110.5, 1.8);

  screen({ x: 5.4, z: -9, side: "right", label: "CONCEPT REVEAL", sub: "AI VIDEO · SEEDANCE", video: "assets/video/concept.mp4" });
  screen({ x: -4.9, z: -20, side: "left", label: "OFFICIAL TRAILER", sub: "16 S · CODE-RENDERED", video: "assets/video/trailer.mp4" });
  screen({ x: 4.9, z: -24, side: "right", label: "DRIVE TEST", sub: "6WD SKID-STEER", video: "assets/video/drive.mp4" });
  screen({ x: -4.9, z: -42, side: "left", label: "ARM", sub: "MULTI-AXIS · PCA9685", video: "assets/video/arm.mp4" });
  screen({ x: 4.9, z: -46, side: "right", label: "GRIPPER", sub: "PICK · HOLD · HAND-OFF", video: "assets/video/grab.mp4" });
  screen({ x: 4.6, z: -64, side: "right", w: 7.2, label: "DASHBOARD", sub: "LIVE CONTROL STATION", video: "assets/video/dashboard.mp4" });
  screen({ x: -4.9, z: -66, side: "left", label: "LIGHTS", sub: "ONBOARD ILLUMINATION", video: "assets/video/lights.mp4" });
  screen({ x: -4.9, z: -86, side: "left", label: "CAD RENDER", sub: "FRONT THREE-QUARTER", image: "assets/img/render-front.webp" });
  screen({ x: 4.9, z: -88, side: "right", label: "PROTOTYPE", sub: "THE REAL BUILD", image: "assets/img/still-arm.jpg" });

  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => {
    buildContent();
    start();
  });
})();
