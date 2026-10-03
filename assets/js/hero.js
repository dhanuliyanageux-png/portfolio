/* Interactive character hero
   ---------------------------------------------------------------
   She watches your real cursor.

     - Move the mouse and her head turns toward it, continuously:
       far left  <->  facing you  <->  far right.
     - Rest the cursor near her and she greets you: takes the headset
       off, waves, points down at the portfolio.
     - Leave the window, or stop moving for a few seconds, and she
       eases back to working at her laptop.
     - Phones / touch: no cursor. She greets once when she scrolls
       into view; tap to replay.

   Frames live in assets/hero/<clip>-NN.jpg and are drawn to a canvas
   from one requestAnimationFrame loop. The cursor sets a target "look"
   value in [-1, 1]; a smoothed copy of it picks a position along the
   gaze clip, and neighbouring frames are blended so the turn is fluid.
   No framework, no per-frame DOM work.
*/
(function () {
  "use strict";

  var stage = document.querySelector("[data-stage]");
  if (!stage) return;

  var canvas = stage.querySelector("canvas");
  var figure = stage.querySelector(".stage__figure");
  var bubble = stage.querySelector("[data-bubble]");
  var sayHi = stage.querySelector("[data-say-hi]");
  var ctx = canvas.getContext("2d", { alpha: false });
  var W = canvas.width, H = canvas.height;

  var BASE = "assets/hero/";
  var FRAME_VER = 6;     // bump when the frames are regenerated (busts browser caches)
  // gaze: 0 = looking far left ... GAZE_C = facing you ... 68 = looking far right
  var CLIPS = { idle: 10, gaze: 69, greet: 103 };
  var GAZE_C = 34;
  var GREET_FPS = 16;
  var GREET_FROM = 6.4; // greet frame that matches the "facing you" gaze frame
  var GREET_SPEED = 1.25; // play the greeting a touch quicker than the source

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var compactMQ = window.matchMedia("(max-width: 799px), (hover: none)");
  function setMode() { stage.setAttribute("data-mode", compactMQ.matches ? "touch" : "hover"); }
  setMode();
  if (compactMQ.addEventListener) compactMQ.addEventListener("change", setMode);

  var LINES = {
    left: "Anyone here on the left?",
    right: "Anyone here on the right?"
  };

  /* ---------------- speech pill ---------------- */
  var bubbleTimer = 0, bubbleHide = 0, bubbleText = "";
  function say(text, pos) {
    if (bubbleText === text && bubble.classList.contains("is-on")) return;
    clearTimeout(bubbleTimer);
    var show = function () {
      bubbleText = text;
      bubble.textContent = text;
      bubble.setAttribute("data-pos", pos);
      bubble.classList.add("is-on");
    };
    if (bubble.classList.contains("is-on")) {
      bubble.classList.remove("is-on");
      bubbleTimer = setTimeout(show, 230);
    } else {
      show();
    }
  }
  function hush() {
    clearTimeout(bubbleTimer);
    clearTimeout(bubbleHide);
    bubbleText = "";
    bubble.classList.remove("is-on");
  }

  function zoneOf(clientX) {
    var r = stage.getBoundingClientRect();
    var x = (clientX - r.left) / r.width;
    return x < 1 / 3 ? "left" : x > 2 / 3 ? "right" : "center";
  }

  /* Reduced motion: no character animation, but the sides still get
     their small contextual message. */
  if (reduce) {
    stage.classList.add("is-static");
    var quietTimer = 0, quietZone = null;
    stage.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse" || compactMQ.matches) return;
      var z = zoneOf(e.clientX);
      if (z === quietZone) return;
      quietZone = z;
      say(z === "center" ? "Hey, it's you!" : LINES[z], z === "center" ? "right" : z);
      clearTimeout(quietTimer);
      quietTimer = setTimeout(hush, 2600);
    });
    stage.addEventListener("pointerleave", function () { quietZone = null; });
    return;
  }

  /* ---------------- frame loading ---------------- */
  var frames = {}, loading = {};
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function loadClip(name) {
    if (loading[name]) return loading[name];
    var count = CLIPS[name];
    var arr = (frames[name] = new Array(count));
    loading[name] = Promise.all(Array.from({ length: count }, function (_, i) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.decoding = "async";
        img.onload = function () { arr[i] = img; resolve(); };
        img.onerror = function () { resolve(); };
        img.src = BASE + name + "-" + pad(i) + ".jpg?v=" + FRAME_VER;
      });
    }));
    return loading[name];
  }

  /* ---------------- look: cursor -> smoothed gaze ---------------- */
  var targetLook = 0;  // where the cursor says she should look, -1..1
  var pointerLook = 0; // same, but always tracks the pointer (even mid-greeting)
  var look = 0;        // smoothed value actually shown
  var lookVel = 0;
  var OMEGA = 13;      // spring stiffness (rad/s): higher = snappier
  var VMAX = 4.2;      // speed cap, look-units / second: a full sweep takes >= ~0.5s

  // Her head's screen position is cached (it only changes on scroll/resize), so
  // pointer events never force a layout.
  var headX = 0, headStale = true;
  function measureHead() {
    var r = figure.getBoundingClientRect();
    headX = r.left + r.width * 0.404;                 // her head, when facing you
    headStale = false;
  }
  window.addEventListener("scroll", function () { headStale = true; }, { passive: true });
  window.addEventListener("resize", function () { headStale = true; });

  // Proportional across the WHOLE window: the further the cursor is from her,
  // the further she turns; full turn a little before the screen edge. (Before,
  // it saturated ~400px from her head, so most of the screen just pinned her
  // looking hard left or right.)
  function lookFromX(clientX) {
    if (headStale) measureHead();
    var edge = clientX < headX ? headX : window.innerWidth - headX;
    var v = (clientX - headX) / Math.max(240, edge);
    v = Math.max(-1, Math.min(1, v * 1.3));
    var dead = 0.035;
    if (Math.abs(v) < dead) return 0;
    v = (v < 0 ? -1 : 1) * (Math.abs(v) - dead) / (1 - dead);
    // Snap the target to a real frame. The smoothed value still glides between
    // frames while she turns, but she always comes to rest on a crisp frame
    // instead of holding a half-blended (ghosted) pose.
    return Math.round(v * GAZE_C) / GAZE_C;
  }

  /* ---------------- rendering ---------------- */
  var idleClock = 0; // frames, ping-pong
  function idlePos() {
    var n = CLIPS.idle - 1, period = n * 2, x = idleClock % period;
    return x <= n ? x : period - x;
  }
  function gazePos() { return GAZE_C + look * GAZE_C; }

  var A = { clip: "idle", pos: 0 }; // bottom layer
  var B = null;                     // cross-fading-in layer
  var fade = 0;

  function posOf(l) {
    if (l.clip === "idle") return idlePos();
    if (l.clip === "gaze" && l.live) return gazePos();
    return l.pos;
  }

  function drawLayer(l, alpha) {
    var arr = frames[l.clip];
    if (!arr) return;
    var p = Math.max(0, Math.min(arr.length - 1, posOf(l)));
    var i0 = Math.floor(p), f = p - i0;
    var a = arr[i0], b = arr[Math.min(i0 + 1, arr.length - 1)];
    if (!a) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(a, 0, 0, W, H);
    if (b && b !== a && f > 0.002) {
      ctx.globalAlpha = alpha * f;
      ctx.drawImage(b, 0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }
  var lastSig = "";
  function render() {
    // skip the canvas work when nothing on screen would change
    var sig = A.clip + ":" + posOf(A).toFixed(3) + (B ? "|" + B.clip + ":" + posOf(B).toFixed(3) + ":" + fade.toFixed(3) : "");
    if (sig === lastSig) return;
    lastSig = sig;
    drawLayer(A, 1);
    if (B) drawLayer(B, fade);
  }

  /* ---------------- tiny task scheduler ---------------- */
  var CANCEL = {};
  var token = 0;
  var tasks = [];
  // fn(k) may return true to finish early
  function tween(ms, fn, tk) {
    return new Promise(function (resolve, reject) {
      tasks.push({ el: 0, ms: ms, fn: fn, resolve: resolve, reject: reject, tk: tk });
    });
  }
  function stepTasks(dtMs) {
    for (var i = tasks.length - 1; i >= 0; i--) {
      var t = tasks[i];
      if (t.tk !== token) { tasks.splice(i, 1); t.reject(CANCEL); continue; }
      t.el += dtMs;
      var k = Math.min(1, t.el / t.ms);
      var early = t.fn(k) === true;
      if (k >= 1 || early) { tasks.splice(i, 1); t.resolve(); }
    }
  }
  function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

  function settle() {
    if (B) { A = fade > 0.5 ? B : A; B = null; fade = 0; }
  }
  function fadeTo(clip, pos, ms, tk, live) {
    settle();
    if (A.clip === clip && (clip === "idle" || (clip === "gaze" && live && A.live))) return Promise.resolve();
    B = { clip: clip, pos: pos, live: !!live };
    fade = 0;
    return tween(ms, function (k) { fade = ease(k); }, tk).then(function () {
      A = B; B = null; fade = 0;
    });
  }

  /* ---------------- main loop (only while visible) ---------------- */
  var mode = "rest";        // rest | track | greeting
  var ready = false;
  var visible = true, raf = 0, last = 0;
  var lastMove = -1e9;      // ms timestamp of last mouse movement
  var lastGreetEnd = -1e9;
  var greetedOnce = false;   // the hover-to-greet fires once per visit; click / button any time
  var awayT = 0;             // seconds the cursor has been far away during a greeting
  var engageLockUntil = 0;
  var dwell = 0;            // seconds the cursor has rested near her
  var side = { left: 0, right: 0 };
  var sideCool = { left: 0, right: 0 };

  function loop(now) {
    if (!visible || document.hidden) { raf = 0; return; }
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    idleClock += dt * 5;                                   // idle: 5 frames / second
    // critically damped spring with a speed cap: eases in and out, never snaps
    lookVel += (OMEGA * OMEGA * (targetLook - look) - 2 * OMEGA * lookVel) * dt;
    lookVel = Math.max(-VMAX, Math.min(VMAX, lookVel));
    look += lookVel * dt;
    stepTasks(dt * 1000);

    // don't lock her out: if the cursor heads well away mid-greeting, wrap up and follow it
    if (mode === "greeting" && Math.abs(pointerLook) > 0.5 && performance.now() - lastMove < 1500) {
      awayT += dt;
      if (awayT > 0.7) { awayT = 0; abortGreet(); }
    } else { awayT = 0; }

    if (mode === "track" && !B) {
      var t = performance.now();
      // rest the cursor near her -> greeting
      if (Math.abs(targetLook) < 0.16 && (!greetedOnce || t - lastGreetEnd > 60000)) {
        dwell += dt;
        if (dwell > 0.55) { dwell = 0; greet(); }
      } else {
        dwell = 0;
      }
      // cursor parked far to one side -> a small remark, at most every ~9s
      ["left", "right"].forEach(function (s) {
        var out = s === "left" ? targetLook < -0.55 : targetLook > 0.55;
        side[s] = out ? side[s] + dt : 0;
        if (side[s] > 0.35 && t > sideCool[s] && mode === "track") {
          sideCool[s] = t + 9000;
          say(LINES[s], s);
          clearTimeout(bubbleHide);
          bubbleHide = setTimeout(hush, 2600);
        }
      });
      // stopped moving for a while -> back to work
      if (t - lastMove > 6000) disengage();
    }

    render();
    raf = requestAnimationFrame(loop);
  }
  function kick() {
    if (raf || !ready) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) kick();
    }, { threshold: 0.05 }).observe(figure);
  }
  document.addEventListener("visibilitychange", kick);

  /* ---------------- states ---------------- */
  async function engage() {
    var tk = ++token;
    mode = "track";
    dwell = 0;
    try {
      await loadClip("gaze");
      if (tk !== token) return;
      await fadeTo("gaze", GAZE_C, 320, tk, true);
    } catch (e) { if (e !== CANCEL) throw e; }
  }

  async function disengage() {
    var tk = ++token;
    mode = "rest";
    targetLook = 0;
    hush();
    try {
      await tween(400, function () {}, tk);                 // let the head come back to centre
      await fadeTo("idle", 0, 700, tk);
    } catch (e) { if (e !== CANCEL) throw e; }
  }

  function abortGreet() {
    var tk = ++token;
    hush();
    lastGreetEnd = performance.now();
    mode = "track";
    targetLook = pointerLook;
    fadeTo("gaze", GAZE_C, 380, tk, true).catch(function (e) { if (e !== CANCEL) throw e; });
  }

  // speech cues for the greeting, in ms from the start of the source clip
  var CUES = [
    { from: 200,  to: 1750, text: "Hey, it's you!",         pos: "right" },
    { from: 3650, to: 5000, text: "Hiiii!",                 pos: "hand"  },
    { from: 5200, to: 1e9,  text: "Check out the portfolio", pos: "right" }
  ];

  async function greet() {
    var tk = ++token;
    mode = "greeting";
    greetedOnce = true;
    dwell = 0;
    targetLook = 0;
    hush();
    try {
      await loadClip("greet");
      if (tk !== token) return;
      var lastF = CLIPS.greet - 1;
      var dur = ((lastF - GREET_FROM) / GREET_FPS) * 1000;   // in source milliseconds
      var t0 = (GREET_FROM / GREET_FPS) * 1000;

      // if she's turned away, come back to face the visitor first
      if (A.clip === "gaze" && A.live && !B) {
        await tween(700, function () { return Math.abs(look) < 0.06; }, tk);
      }
      await fadeTo("greet", GREET_FROM, A.clip === "gaze" ? 240 : 500, tk);

      await tween(dur / GREET_SPEED, function (k) {
        A.pos = GREET_FROM + k * (lastF - GREET_FROM);
        var ms = t0 + k * dur, cue = null;
        for (var i = 0; i < CUES.length; i++) if (ms >= CUES[i].from && ms < CUES[i].to) cue = CUES[i];
        if (cue) say(cue.text, cue.pos); else if (bubbleText) hush();
      }, tk);
      hush();
      lastGreetEnd = performance.now();
      // no held pose, no dead pause: the instant the gesture ends she is already
      // moving back - hand coming down, headset going back on - at a constant pace
      // (not eased, which would start at zero speed right where the gesture just
      // settled and look like a second stall). This plays out fully before the
      // cross-fade to idle starts: fading at the same time as this motion means
      // blending against her idle *typing loop*, which is itself constantly
      // cycling frames underneath - two independently moving layers at once reads
      // as flicker, not a smooth handoff.
      var revDur = (dur / GREET_SPEED) / 2;
      await tween(revDur, function (k) {
        A.pos = lastF - k * (lastF - GREET_FROM);
      }, tk);
      await fadeTo("idle", 0, 300, tk);
      mode = "rest";
      engageLockUntil = performance.now() + 600; // a beat at the laptop before she starts watching again
    } catch (e) { if (e !== CANCEL) throw e; }
  }

  /* ---------------- input: the real cursor ---------------- */
  document.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse" || compactMQ.matches || !ready) return;
    lastMove = performance.now();
    pointerLook = lookFromX(e.clientX);
    if (mode !== "greeting") targetLook = pointerLook;
    if (mode === "rest" && lastMove > engageLockUntil) engage();
  }, { passive: true });

  // cursor left the window: wander back to work shortly
  document.documentElement.addEventListener("mouseleave", function () {
    lastMove = performance.now() - 4000;
  });

  // click / tap her, or the keyboard button, to say hello
  function hello() { if (ready && mode !== "greeting") greet(); }
  figure.addEventListener("click", hello);
  if (sayHi) sayHi.addEventListener("click", function (e) { e.stopPropagation(); hello(); });

  /* ---------------- boot ---------------- */
  loadClip("idle").then(function () {
    if (!frames.idle[0]) return; // frames missing: keep the still poster
    ready = true;
    render();
    stage.classList.add("is-ready");
    kick();

    // background loading, most-needed first
    var chain = compactMQ.matches
      ? loadClip("greet")
      : loadClip("gaze").then(function () { return loadClip("greet"); });

    // small screens have no cursor: greet once, when she's on screen
    if (compactMQ.matches) {
      var played = false;
      var start = function () {
        if (played) return;
        played = true;
        setTimeout(function () { if (mode === "rest") greet(); }, 700);
      };
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) { io.disconnect(); start(); }
        }, { threshold: 0.6 });
        io.observe(figure);
      } else { start(); }
    }
    return chain;
  });
})();
