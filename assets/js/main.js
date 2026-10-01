/* ==========================================================
   TEAM AANYA — interactions
   ========================================================== */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Asset URLs: relative by default; a deployment can serve them from a CDN by
  // setting window.AANYA_ASSET_BASE before this script runs.
  const asset = (p) => (/^(https?:|data:|blob:)/.test(p) ? p : (window.AANYA_ASSET_BASE || "") + p);

  const pad2 = (n) => String(n).padStart(2, "0");

  /* ---------- boot preloader ---------- */
  const boot = $("#boot");
  const bootLines = [
    ["pwmchip0 · pwm0/pwm1", "OK"],
    ["i2c-1 · PCA9685 @0x40", "OK"],
    ["RAIL A · 5V LOGIC", "STABLE"],
    ["RAIL B · MOTOR BUS", "ARMED"],
    ["CAM · GRIPPER · LIGHTS", "OK"],
    ["AANYA · SYSTEMS", "GO"],
  ];
  function finishBoot() {
    boot.classList.add("is-done");
    document.body.classList.remove("is-booting");
  }
  // The boot screen ends on an "Enter" button: one click opens the site and,
  // because it is a real click, also lets the background music start.
  const enterBtn = $("#bootEnter");
  const showEnter = () => { enterBtn.hidden = false; enterBtn.focus({ preventScroll: true }); };
  enterBtn.addEventListener("click", finishBoot);
  document.body.classList.add("is-booting");
  const bootLog = $("#bootLog");
  const bootBar = $("#bootBar");
  const quick = reduced || sessionStorageGet("aanya-booted");
  bootLines.forEach(([k, v], i) => {
    setTimeout(() => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${k}</span><b>${v}</b>`;
      bootLog.appendChild(li);
      bootBar.style.width = ((i + 1) / bootLines.length) * 100 + "%";
    }, quick ? 0 : 180 + i * 230);
  });
  setTimeout(showEnter, quick ? 50 : 180 + bootLines.length * 230 + 200);
  sessionStorageSet("aanya-booted", "1");
  function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } }

  /* ---------- nav ---------- */
  const nav = $("#nav");
  const burger = $("#burger");
  const links = $("#navLinks");
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 30);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  burger.addEventListener("click", () => {
    const open = burger.getAttribute("aria-expanded") !== "true";
    burger.setAttribute("aria-expanded", open);
    links.classList.toggle("is-open", open);
  });
  $$("a", links).forEach((a) => a.addEventListener("click", () => {
    burger.setAttribute("aria-expanded", "false");
    links.classList.remove("is-open");
  }));

  // highlight current section
  const navMap = new Map($$("a[href^='#']", links).map((a) => [a.getAttribute("href").slice(1), a]));
  const secObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const a = navMap.get(e.target.id);
      if (a && e.isIntersecting) {
        navMap.forEach((x) => x.classList.remove("is-active"));
        a.classList.add("is-active");
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  navMap.forEach((_, id) => { const el = document.getElementById(id); if (el) secObs.observe(el); });

  /* ---------- reveal + counters ---------- */
  const revObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      const n = $("[data-count]", e.target);
      if (n) countUp(n);
      revObs.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  $$(".reveal").forEach((el, i) => {
    el.style.transitionDelay = (i % 4) * 70 + "ms";
    revObs.observe(el);
  });
  function countUp(el) {
    const end = +el.dataset.count;
    const suf = el.dataset.suffix || "";
    if (reduced || end === 0) { el.textContent = end + suf; return; }
    const t0 = performance.now();
    const dur = 1400;
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suf;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- hero: video if present, parallax, clock ---------- */
  const hero = $("#hero");
  const heroVideo = $("#heroVideo");
  heroVideo.addEventListener("loadeddata", () => hero.classList.add("has-video"));
  if (heroVideo.readyState >= 2) hero.classList.add("has-video");

  const media = $("#heroMedia");
  if (!reduced && matchMedia("(pointer: fine)").matches) {
    hero.addEventListener("pointermove", (e) => {
      const x = e.clientX / innerWidth - 0.5;
      const y = e.clientY / innerHeight - 0.5;
      media.style.transform = `translate3d(${x * -18}px, ${y * -12}px, 0) scale(1.02)`;
    });
  }
  const hudClock = $("#hudClock");
  const tickClock = () => {
    const d = new Date();
    hudClock.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  };
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------- modal (lightbox + video) ---------- */
  const modal = $("#modal");
  const modalBody = $("#modalBody");
  let lastFocus = null;
  function openModal(html) {
    lastFocus = document.activeElement;
    modalBody.innerHTML = html;
    modal.hidden = false;
    if (window.aanyaAudio) window.aanyaAudio.duck(true);
    document.body.style.overflow = "hidden";
    $("#modalX").focus();
  }
  function closeModal() {
    modal.hidden = true;
    if (window.aanyaAudio) window.aanyaAudio.duck(false);
    modalBody.innerHTML = "";
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }
  $("#modalX").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  $$(".shot").forEach((f) => f.addEventListener("click", () => {
    const img = $("img", f);
    openModal(`<img src="${img.getAttribute("src")}" alt="${img.alt}">`);
  }));
  const playTrailer = () => openModal(`<video src="${asset("assets/video/trailer.mp4")}" controls autoplay playsinline></video>`);
  ["#watchBtn", "#watchBtnHero"].forEach((id) => { const b = $(id); if (b) b.addEventListener("click", playTrailer); });
  // Used by the 3D hangar (hangar.js) when a screen is clicked.
  window.aanyaOpenVideo = (src) => openModal(`<video src="${src}" controls autoplay playsinline loop></video>`);
  window.aanyaOpenImage = (src, alt) => openModal(`<img src="${src}" alt="${alt}">`);

  /* ---------- in-action player ---------- */
  const player = $("#playerVideo");
  const playerTitle = $("#playerTitle");
  const playerTime = $("#playerTime");
  $$("#playerList button").forEach((b) => b.addEventListener("click", () => {
    $$("#playerList button").forEach((x) => x.classList.toggle("is-on", x === b));
    player.poster = b.dataset.poster;
    player.src = b.dataset.src;
    playerTitle.textContent = b.dataset.title;
    player.play().catch(() => {});
  }));
  player.addEventListener("timeupdate", () => {
    const t = Math.floor(player.currentTime);
    playerTime.textContent = `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
  });
  $("#playerFull").addEventListener("click", () => {
    openModal(`<video src="${player.getAttribute("src")}" controls autoplay playsinline loop></video>`);
  });

  // Play background/inline videos only while on screen.
  const visObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting && !reduced) v.play().catch(() => {});
      else v.pause();
    });
  }, { threshold: 0.25 });
  [player, heroVideo, ...$$("video.autoplay-visible")].forEach((v) => visObs.observe(v));

  /* ---------- contact form → email ---------- */
  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const subject = `${f.get("topic")} · ${f.get("name")}`;
    const body = `${f.get("message")}\n\n${f.get("name")}\n${f.get("email")}`;
    location.href = `mailto:saathviku@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  /* ---------- rover hotspots ---------- */
  const spots = {
    arm: {
      tag: "MANIPULATOR",
      title: "Robotic arm",
      body: "A multi-axis arm with a camera at its wrist. Every joint is a servo channel on a PCA9685 PWM controller, talking to the Jetson over an isolated I2C bus.",
      specs: [["Controller", "PCA9685 · 12-bit"], ["Bus", "I2C · Pins 3 / 5"], ["End effector", "Camera mount"]],
    },
    comms: {
      tag: "SENSING",
      title: "Antennas & sensors",
      body: "Wireless links and the sensor mast. This is where GPS telemetry and the 360° LiDAR feed into the perception pipeline.",
      specs: [["GPS", "Lat · Lon · Heading · Fix"], ["LiDAR", "360° point cloud"], ["Status", "Integration in progress"]],
    },
    brain: {
      tag: "ELECTRONICS BAY",
      title: "The brain",
      body: "An NVIDIA Jetson Orin Nano runs the whole rover. It generates motor PWM directly from the Linux kernel's sysfs interface, with no microcontroller in between.",
      specs: [["Compute", "Jetson Orin Nano"], ["OS", "Ubuntu · JetPack"], ["Motor PWM", "sysfs · pwmchip0"], ["Logic rail", "Isolated 5 V / 3 A"]],
    },
    legs: {
      tag: "SUSPENSION",
      title: "Rocker-bogie",
      body: "Each side has a rocker and a bogie, joined across the body by a differential, so all six wheels stay on the ground over rough terrain.",
      specs: [["Wheels", "6 driven"], ["Suspension", "Rocker-bogie"], ["Linkage", "Differential shaft"]],
    },
    wheels: {
      tag: "DRIVETRAIN",
      title: "6WD skid-steer",
      body: "Left and right wheel banks are driven differentially, so AANYA can turn on the spot with a zero-radius yaw.",
      specs: [["Motors", "6× brushed DC"], ["Drivers", "3× Cytron MDD10A"], ["Kinematics", "Skid-steer"], ["Power", "Dedicated motor rail"]],
    },
  };
  const spotTag = $("#spotTag"), spotTitle = $("#spotTitle"), spotBody = $("#spotBody"), spotSpecs = $("#spotSpecs");
  function showSpot(key, btn) {
    const s = spots[key];
    $$(".hotspot").forEach((b) => b.classList.toggle("is-on", b === btn));
    spotTag.textContent = s.tag;
    spotTitle.textContent = s.title;
    spotBody.textContent = s.body;
    spotSpecs.innerHTML = s.specs.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join("");
  }
  $$(".hotspot").forEach((b) => b.addEventListener("click", () => showSpot(b.dataset.spot, b)));
  const firstSpot = $(".hotspot[data-spot='brain']");
  if (firstSpot) showSpot("brain", firstSpot);

  /* ---------- kernel terminal (types when visible) ---------- */
  const termBody = $("#termBody");
  const termScript = [
    ["c", "# before: the library route"],
    ["p", "$ python3 drive.py"],
    ["e", "RuntimeError: Device or resource busy (pin 32)"],
    ["c", "# unlock pins 32/33 as PWM"],
    ["p", "$ sudo /opt/nvidia/jetson-io/jetson-io.py"],
    ["ok", "  [*] pwm0  [*] pwm1   → saved, reboot"],
    ["c", "# talk to the kernel directly"],
    ["p", "$ echo 0     > /sys/class/pwm/pwmchip0/export"],
    ["p", "$ echo 50000 > .../pwm0/period      # 20 kHz"],
    ["p", "$ echo 17500 > .../pwm0/duty_cycle  # 35%"],
    ["p", "$ echo 1     > .../pwm0/enable"],
    ["ok", "  motors spinning · deterministic · no MCU"],
  ];
  const esc = (t) => t.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
  function renderTerm(lines, partial = "") {
    termBody.innerHTML = lines.map(([c, t]) => `<span class="${c}">${esc(t)}</span>`).join("\n") +
      (partial ? "\n" + partial : "") + '<span class="caret"></span>';
  }
  let termStarted = false;
  new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting || termStarted) return;
    termStarted = true;
    obs.disconnect();
    if (reduced) { renderTerm(termScript); return; }
    const done = [];
    let i = 0;
    const next = () => {
      if (i >= termScript.length) { renderTerm(done); return; }
      const [cls, text] = termScript[i];
      if (cls === "p") {
        let j = 0;
        const type = () => {
          j += 2;
          renderTerm(done, `<span class="p">${esc(text.slice(0, j))}</span>`);
          if (j < text.length) setTimeout(type, 18);
          else { done.push(termScript[i++]); setTimeout(next, 160); }
        };
        type();
      } else {
        done.push(termScript[i++]);
        renderTerm(done);
        setTimeout(next, cls === "e" ? 600 : 260);
      }
    };
    next();
  }, { threshold: 0.4 }).observe(termBody);

  /* ---------- mission control console ---------- */
  const consoleEl = $("#console");
  const logEl = $("#log");
  let mode = "ai";
  function log(msg, accent = false) {
    const d = new Date();
    const li = document.createElement("li");
    if (accent) li.className = "a";
    li.innerHTML = `<span>${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}</span>${esc(msg)}`;
    logEl.appendChild(li);
    while (logEl.children.length > 6) logEl.firstChild.remove();
  }
  $$(".mode__btn").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    consoleEl.dataset.mode = m;
    $$(".mode__btn").forEach((b) => b.classList.toggle("is-on", b.dataset.mode === m));
    if (m === "manual") log("MANUAL OVERDRIVE ENGAGED · AI commands ignored", true);
    else log("AI PILOT ENGAGED · planner in control", true);
  }
  log("Console online · simulation mode");
  log("Waiting for rover link…");

  // uptime
  const uptimeEl = $("#uptime");
  const t0 = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    uptimeEl.textContent = `T+${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`;
  }, 1000);

  // input: gamepad or keyboard
  const keys = new Set();
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (!["w", "a", "s", "d"].includes(k)) return;
    if (e.target.closest("input, textarea")) return;
    keys.add(k);
    if (mode !== "manual" && isConsoleVisible()) setMode("manual");
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  addEventListener("gamepadconnected", (e) => log(`Gamepad connected · ${e.gamepad.id.slice(0, 28)}`, true));
  addEventListener("gamepaddisconnected", () => log("Gamepad disconnected · failsafe stop", true));

  let consoleVisible = false;
  new IntersectionObserver((en) => { consoleVisible = en[0].isIntersecting; }).observe(consoleEl);
  const isConsoleVisible = () => consoleVisible;

  function readManual() {
    // Gamepad: right trigger = forward, left trigger = reverse, left stick X = yaw.
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (gp) {
      const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
      const lt = gp.buttons[6] ? gp.buttons[6].value : 0;
      let yaw = gp.axes[0] || 0;
      if (Math.abs(yaw) < 0.08) yaw = 0; // deadzone
      return { throttle: rt - lt, yaw, src: "GAMEPAD" };
    }
    const throttle = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0);
    const yaw = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
    return { throttle: throttle * 0.8, yaw: yaw * 0.7, src: "KEYBOARD" };
  }

  // Skid-steer mixing: left = throttle + yaw, right = throttle - yaw, normalised to ±1.
  function mix(throttle, yaw) {
    let l = throttle + yaw;
    let r = throttle - yaw;
    const m = Math.max(1, Math.abs(l), Math.abs(r));
    return [l / m, r / m];
  }

  const barL = $("#barL"), barR = $("#barR"), valL = $("#valL"), valR = $("#valR");
  const padDot = $("#padDot"), inputSrc = $("#inputSrc");
  const headingEl = $("#heading"), needle = $("#needle"), nearestEl = $("#nearest");
  function setBar(el, v) {
    const w = Math.abs(v) * 50;
    el.style.width = w + "%";
    el.style.left = v >= 0 ? "50%" : 50 - w + "%";
  }

  // simulated world for the radar
  const obstacles = Array.from({ length: 14 }, () => ({
    a: Math.random() * Math.PI * 2,
    d: 0.25 + Math.random() * 0.7,
  }));
  let heading = 0;
  let cmd = { throttle: 0, yaw: 0 };
  let aiT = 0;

  const radar = $("#radar");
  const ctx = radar.getContext("2d");
  const R = radar.width / 2;
  let sweep = 0;
  const css = (v) => getComputedStyle(consoleEl).getPropertyValue(v).trim();

  function drawRadar(accent) {
    ctx.clearRect(0, 0, radar.width, radar.height);
    ctx.save();
    ctx.translate(R, R);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(0, 0, (R - 8) * i / 4, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (R - 8), Math.sin(a) * (R - 8)); ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "16px JetBrains Mono, monospace";
    ctx.fillText("1m", 6, -(R - 8) / 4 + 18);
    ctx.fillText("4m", 6, -(R - 8) + 18);

    // sweep wedge
    const g = ctx.createConicGradient ? ctx.createConicGradient(sweep - 0.6, 0, 0) : null;
    if (g) {
      g.addColorStop(0, "transparent");
      g.addColorStop(0.095, hexA(accent, 0.35));
      g.addColorStop(0.0955, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, R - 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(sweep) * (R - 8), Math.sin(sweep) * (R - 8)); ctx.stroke();

    // points (world rotates with heading)
    let nearest = Infinity;
    obstacles.forEach((o) => {
      const a = o.a - heading;
      const x = Math.cos(a) * o.d * (R - 8);
      const y = Math.sin(a) * o.d * (R - 8);
      let diff = ((sweep - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const glow = Math.max(0.15, 1 - diff / 3);
      const close = o.d < 0.4;
      ctx.fillStyle = close ? `rgba(255,59,79,${glow})` : hexA(accent, glow);
      ctx.beginPath(); ctx.arc(x, y, close ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
      nearest = Math.min(nearest, o.d * 4);
    });
    nearestEl.textContent = nearest.toFixed(2) + " m";

    // rover
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function hexA(color, a) {
    const m = color.match(/^#([0-9a-f]{6})$/i);
    if (!m) return color;
    const n = parseInt(m[1], 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  let last = performance.now();
  function frame(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    if (consoleVisible) {
      if (mode === "manual") {
        const m = readManual();
        cmd = m;
        inputSrc.textContent = m.src;
      } else {
        // demo "AI" wander: gentle cruise with slow yaw corrections
        aiT += dt;
        cmd = { throttle: 0.45 + Math.sin(aiT * 0.5) * 0.1, yaw: Math.sin(aiT * 0.35) * 0.35 };
        inputSrc.textContent = "AI";
      }
      const [l, r] = mix(cmd.throttle, cmd.yaw);
      setBar(barL, l); setBar(barR, r);
      valL.textContent = Math.round(l * 100) + "%";
      valR.textContent = Math.round(r * 100) + "%";
      padDot.style.transform = `translate(${cmd.yaw * 55}px, ${-cmd.throttle * 55}px)`;

      heading += (l - r) * 0.9 * dt;
      // drift obstacles toward the rover when moving forward
      const fwd = (l + r) / 2;
      obstacles.forEach((o) => {
        const x = Math.cos(o.a - heading) * o.d;
        let y = Math.sin(o.a - heading) * o.d;
        y += fwd * 0.12 * dt; // forward = toward -y on screen, so the world slides +y
        o.d = Math.hypot(x, y);
        o.a = Math.atan2(y, x) + heading;
        if (o.d > 1 || o.d < 0.1) { o.a = Math.random() * Math.PI * 2; o.d = 0.85 + Math.random() * 0.12; }
      });
      const deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
      headingEl.textContent = pad2(Math.round(deg)).padStart(3, "0") + "°";
      needle.style.transform = `rotate(${deg}deg)`;

      sweep = (sweep + dt * 2.4) % (Math.PI * 2);
      drawRadar(css("--accent") || "#4fd3d6");
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  drawRadar("#4fd3d6");

  /* ---------- "how we built it" badges: tap to open on touch screens ---------- */
  $$(".brand").forEach((b) => b.addEventListener("click", () => {
    const open = !b.classList.contains("is-open");
    $$(".brand.is-open").forEach((x) => x.classList.remove("is-open"));
    b.classList.toggle("is-open", open);
  }));
  document.addEventListener("click", (e) => { if (!e.target.closest(".brand")) $$(".brand.is-open").forEach((x) => x.classList.remove("is-open")); });

  /* ---------- footer year ---------- */
  $("#year").textContent = new Date().getFullYear();
})();
