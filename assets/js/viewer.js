/* ==========================================================
   TEAM AANYA — interactive rover viewer
   Loads the CAD export (assets/model/aanya.glb, made with
   tools/step_to_glb.py) so visitors can orbit, zoom, explode the
   assembly and click any part to read what it does.
   ========================================================== */
(() => {
  "use strict";
  const root = document.getElementById("explore");
  const canvas = document.getElementById("viewerCanvas");
  if (!root || !canvas || !window.THREE || !THREE.GLTFLoader || !THREE.OrbitControls) return;
  const $ = (s) => root.querySelector(s);
  const ui = {
    stage: $(".viewer__stage"), status: $("#viewerStatus"), list: $("#partList"), search: $("#partSearch"),
    count: $("#partCount"), name: $("#partName"), meta: $("#partMeta"), desc: $("#partDesc"),
    explode: $("#explode"), xray: $("#xray"), spin: $("#spin"), reset: $("#resetView"), tip: $("#viewerTip"),
  };
  const TEAL = new THREE.Color(0x4fd3d6);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // What each kind of part does, matched against the CAD part names.
  const ROLES = [
    [/ST3215/i, "Bus servo", "A Feetech ST3215 serial bus servo. Four of them move the arm's base, shoulder, elbow and gripper."],
    [/General Driver/i, "Arm controller", "The arm's control board. It drives the bus servos and talks to the rover's brain."],
    [/OLED/i, "Display", "Small status screen on the arm's control board."],
    [/Wi-?Fi/i, "Wireless", "Wi-Fi module on the arm's control board."],
    [/LED light/i, "Light", "12 V LED light on the arm, used to light up the work area."],
    [/gripper|jaw/i, "Gripper", "Part of the gripper at the end of the arm, used to pick up and hold objects."],
    [/RoArm|Arm (base|shoulder|elbow)|elbow|shoulder/i, "Robotic arm", "Part of the RoArm-M2-S manipulator mounted on top of the rover."],
    [/drone/i, "Drone", "A drone frame carried on the rover's deck."],
    [/gearbox|gear box/i, "Gearbox", "Gear reduction for the drivetrain."],
    [/jetson/i, "Jetson enclosure", "Houses the NVIDIA Jetson Orin Nano, the rover's onboard edge-AI computer."],
    [/battery/i, "Battery", "The high-current pack for the drive motors, kept on its own rail away from the Jetson's logic supply."],
    [/rocker disk/i, "Rocker disk", "Pivot disk where a rocker arm meets the body."],
    [/fastener/i, "Fasteners", "Screws, nuts, washers and standoffs that hold the arm together."],
    [/carbon/i, "Structure", "Carbon-fibre tube: stiff and light."],
    [/extrusion/i, "Structure", "1020 aluminium extrusion used in the arm's mount."],
    [/bearing/i, "Bearing", "Lets a joint rotate smoothly under load."],
    [/detail/i, "Details", "Small details from the CAD model."],
    [/wheel/i, "Wheel assembly", "One of six driven wheels. Each wheel has its own brushed DC motor, powered through the Cytron H-bridges."],
    [/diff/i, "Differential", "Links the left and right rockers so the body tilts at the average of both sides, keeping it level over rough ground."],
    [/rocker/i, "Rocker arm", "The main lever of the rocker-bogie suspension. It pivots on the body so all six wheels stay on the ground."],
    [/bogie/i, "Bogie", "The smaller lever of the rocker-bogie that carries two wheels and lets the rover climb over obstacles."],
    [/servo/i, "Servo mount", "Holds a servo motor. Servos are driven by the PCA9685 PWM controller over I2C."],
    [/arm|gripper|claw|wrist|shoulder|elbow/i, "Robotic arm", "Part of the multi-axis manipulator, driven by servos on the PCA9685 controller."],
    [/camera|cam\b/i, "Camera", "Vision for the perception pipeline and the mission-control video feed."],
    [/body|chassis|box|kit|lid|panel/i, "Body", "The electronics bay: Jetson Orin Nano, three motor drivers and the isolated power rails live here."],
    [/jetson|board|pcb/i, "Electronics", "Onboard compute and control electronics."],
    [/battery/i, "Battery", "Power for the drive motors, kept on its own rail away from the logic supply."],
    [/connector|bracket|holder|joint|pipe|shaft|mount|bearing|plate/i, "Structure", "A structural part that ties the suspension, motors and body together."],
  ];
  const roleOf = (name) => ROLES.find(([re]) => re.test(name)) || [null, "Part", "Part of the AANYA assembly."];
  const groupKey = (name) => name.replace(/\s*\(\d+\)\s*$/, "").replace(/[:_]\d+$/, "").trim() || "Part";

  /* ---------- three setup ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 0.6; controls.maxDistance = 30;
  controls.autoRotate = !reduced; controls.autoRotateSpeed = 0.8;

  // Studio reflections so near-black CAD parts still show their form.
  if (THREE.RoomEnvironment) {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  }
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x0a0d12, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x4fd3d6, 1.4); rim.position.set(-5, 3, -6); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x6aa0ff, 0.4); fill.position.set(-4, 1, 5); scene.add(fill);

  // floor: soft disc + rings
  const floor = new THREE.Group(); scene.add(floor);
  const disc = document.createElement("canvas"); disc.width = disc.height = 256;
  const dg = disc.getContext("2d"), grad = dg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(79,211,214,0.22)"); grad.addColorStop(0.6, "rgba(79,211,214,0.05)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  dg.fillStyle = grad; dg.fillRect(0, 0, 256, 256);
  const discMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(disc), transparent: true, depthWrite: false }));
  discMesh.rotation.x = -Math.PI / 2; floor.add(discMesh);
  [0.32, 0.46].forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.002, 128), new THREE.MeshBasicMaterial({ color: 0x4fd3d6, transparent: true, opacity: 0.35 - i * 0.15, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; floor.add(ring);
  });

  /* ---------- state ---------- */
  let model = null, parts = [], groups = new Map(), selected = null, hovered = null, mmPerUnit = 1;
  const modelCenter = new THREE.Vector3();
  let home = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  let fly = null;

  function resize() {
    const w = ui.stage.clientWidth, h = ui.stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);

  /* ---------- load ---------- */
  const src = root.dataset.model;
  const loader = new THREE.GLTFLoader();
  if (window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder); // model is packed with gltfpack -cc
  loader.load(src, (gltf) => {
    model = gltf.scene;
    // Normalise: centre on the floor, scale to ~4 units across.
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    const s = 4 / Math.max(size.x, size.y, size.z);
    mmPerUnit = 1000 / s; // GLB is in metres (step_to_glb.py)
    model.scale.setScalar(s);
    box.setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
    scene.add(model);
    model.updateMatrixWorld(true);
    new THREE.Box3().setFromObject(model).getCenter(modelCenter);
    const radius = Math.max(size.x, size.z) * s * 0.75;
    floor.scale.setScalar(radius * 2.2);

    model.traverse((o) => {
      if (!o.isMesh) return;
      // three.js turns spaces in node names into underscores; undo that for display.
      // Use the nearest real part name: gltfpack keeps names on the parent node, and
      // three.js names bare meshes "mesh_0" and turns spaces into underscores.
      let n = o, raw = "";
      while (n && n !== model) { if (n.name && !/^mesh_?\d*$/i.test(n.name)) { raw = n.name; break; } n = n.parent; }
      const name = (raw || "Part").replace(/_/g, " ").replace(/\s+/g, " ").trim();
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      const base = o.material && o.material.color ? o.material.color.clone() : new THREE.Color(0x9aa0a8);
      o.material = new THREE.MeshStandardMaterial({
        color: base, vertexColors: !!o.geometry.attributes.color, metalness: 0.25, roughness: 0.5,
        transparent: true, opacity: 1, side: THREE.DoubleSide,
      });
      // explode direction, in the mesh's parent space
      const wc = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      const dir = wc.clone().sub(modelCenter); dir.y *= 0.6;
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      const p0 = o.parent.worldToLocal(wc.clone()), p1 = o.parent.worldToLocal(wc.clone().add(dir));
      o.userData = { name, key: groupKey(name), basePos: o.position.clone(), localDir: p1.sub(p0) };
      parts.push(o);
      const k = o.userData.key;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(o);
    });

    home.target.set(0, box.getSize(new THREE.Vector3()).y * 0.4, 0);
    home.pos.set(radius * 1.5, radius * 1.0, radius * 1.9);
    camera.position.copy(home.pos); controls.target.copy(home.target);
    controls.maxDistance = radius * 6;
    buildList();
    root.classList.add("is-loaded");
    ui.status.hidden = true;
    resize();
  }, (e) => {
    if (e.lengthComputable) ui.status.textContent = `Loading 3D model · ${Math.round((e.loaded / e.total) * 100)}%`;
  }, () => {
    root.classList.add("is-missing");
    ui.status.textContent = "";
  });

  /* ---------- parts list ---------- */
  function buildList() {
    const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
    ui.count.textContent = `${parts.length} parts · ${keys.length} kinds`;
    ui.list.innerHTML = "";
    keys.forEach((k) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button"; b.dataset.key = k;
      const n = groups.get(k).length;
      b.innerHTML = `<span></span><b>${n > 1 ? "×" + n : ""}</b>`;
      b.firstChild.textContent = k;
      b.addEventListener("click", () => select(k, true));
      li.appendChild(b); ui.list.appendChild(li);
    });
  }
  ui.search.addEventListener("input", () => {
    const q = ui.search.value.trim().toLowerCase();
    ui.list.querySelectorAll("li").forEach((li) => { li.hidden = q && !li.textContent.toLowerCase().includes(q); });
  });

  /* ---------- selection ---------- */
  function paint() {
    const xray = ui.xray.checked;
    parts.forEach((o) => {
      const m = o.material, inSel = selected && o.userData.key === selected, isHover = hovered && o.userData.key === hovered;
      m.emissive.copy(inSel ? TEAL : isHover ? TEAL : new THREE.Color(0));
      m.emissiveIntensity = inSel ? 0.45 : isHover ? 0.2 : 0;
      m.opacity = selected && !inSel ? 0.14 : xray ? 0.35 : 1;
      m.depthWrite = m.opacity > 0.9;
      m.wireframe = xray && !inSel;
    });
  }
  function select(key, focus) {
    selected = key;
    ui.list.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b.dataset.key === key));
    if (!key) {
      ui.name.textContent = "Click any part";
      ui.meta.textContent = "Drag to rotate · scroll or pinch to zoom · right-drag to pan";
      ui.desc.textContent = "Every part here comes straight from our CAD assembly in Autodesk Fusion.";
      paint(); return;
    }
    const meshes = groups.get(key);
    const [, role, text] = roleOf(key);
    const bb = new THREE.Box3(); meshes.forEach((m) => bb.expandByObject(m));
    const one = new THREE.Box3().setFromObject(meshes[0]).getSize(new THREE.Vector3()).multiplyScalar(mmPerUnit);
    ui.name.textContent = key;
    ui.meta.textContent = `${role} · ${meshes.length > 1 ? meshes.length + " in the assembly · " : ""}${Math.round(one.x)} × ${Math.round(one.y)} × ${Math.round(one.z)} mm`;
    ui.desc.textContent = text;
    paint();
    if (focus) {
      const c = bb.getCenter(new THREE.Vector3()), r = Math.max(bb.getSize(new THREE.Vector3()).length() * 0.9, 0.6);
      const dir = camera.position.clone().sub(controls.target).normalize();
      fly = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone(), toT: c, toP: c.clone().add(dir.multiplyScalar(r * 1.6)) };
      controls.autoRotate = false; ui.spin.checked = false;
    }
  }

  /* ---------- pointer ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let downAt = null;
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(parts, false).find((h) => h.object.material.opacity > 0.2 || h.object.userData.key === selected);
    return hit ? hit.object.userData.key : null;
  }
  canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const k = pick(e);
    select(k === selected ? null : k, !!k);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!model || e.buttons) return;
    const k = pick(e);
    if (k !== hovered) { hovered = k; paint(); canvas.style.cursor = k ? "pointer" : "grab"; }
    if (k) {
      const r = ui.stage.getBoundingClientRect();
      ui.tip.hidden = false; ui.tip.textContent = k;
      ui.tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
    } else ui.tip.hidden = true;
  });
  canvas.addEventListener("pointerleave", () => { hovered = null; ui.tip.hidden = true; paint(); });
  root.addEventListener("keydown", (e) => { if (e.key === "Escape") select(null); });

  /* ---------- controls ---------- */
  ui.explode.addEventListener("input", () => {
    const k = +ui.explode.value;
    parts.forEach((o) => o.position.copy(o.userData.basePos).addScaledVector(o.userData.localDir, k));
  });
  ui.xray.addEventListener("change", paint);
  ui.spin.checked = controls.autoRotate;
  ui.spin.addEventListener("change", () => (controls.autoRotate = ui.spin.checked));
  ui.reset.addEventListener("click", () => {
    select(null);
    ui.explode.value = 0; ui.explode.dispatchEvent(new Event("input"));
    fly = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone(), toT: home.target.clone(), toP: home.pos.clone() };
  });

  /* ---------- loop (only while on screen) ---------- */
  let visible = false;
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) resize(); }).observe(ui.stage);
  let last = performance.now();
  (function loop(t) {
    requestAnimationFrame(loop);
    if (!visible || !model) return;
    const dt = Math.min((t - last) / 1000, 0.05); last = t;
    if (fly) {
      fly.t = Math.min(1, fly.t + dt * 1.6);
      const e = 1 - Math.pow(1 - fly.t, 3);
      camera.position.lerpVectors(fly.fromP, fly.toP, e);
      controls.target.lerpVectors(fly.fromT, fly.toT, e);
      if (fly.t >= 1) fly = null;
    }
    controls.update();
    renderer.render(scene, camera);
  })(last);
  select(null);
})();
