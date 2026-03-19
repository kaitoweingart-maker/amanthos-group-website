/**
 * Amanthos Group — Immersive Portal + Clean Interactions
 * WebGL water ripple intro + polished scroll animations
 */
(function () {
  'use strict';

  var isDesktop = !window.matchMedia('(pointer: coarse)').matches;

  /* ================================================
   * 1. WEBGL WATER RIPPLE PORTAL
   * ============================================== */
  function initPortal() {
    var portal = document.getElementById('amanthos-portal');
    var canvas = document.getElementById('portal-canvas');
    if (!portal || !canvas) return;

    document.body.classList.add('portal-active');

    var gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false,
      stencil: false, preserveDrawingBuffer: false
    });

    if (!gl) { fallbackPortal(portal); return; }

    // --- Resize ---
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    // --- Shader helpers ---
    function compileShader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s); return null;
      }
      return s;
    }
    function createProgram(vSrc, fSrc) {
      var vs = compileShader(gl.VERTEX_SHADER, vSrc);
      var fs = compileShader(gl.FRAGMENT_SHADER, fSrc);
      if (!vs || !fs) return null;
      var p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
      return p;
    }

    var vertSrc = [
      'attribute vec2 aPos;',
      'varying vec2 vUv;',
      'void main(){',
      '  vUv = aPos * 0.5 + 0.5;',
      '  gl_Position = vec4(aPos, 0.0, 1.0);',
      '}'
    ].join('\n');

    var fragSrc = [
      'precision mediump float;',
      'uniform sampler2D uImg;',
      'uniform sampler2D uRipple;',
      'uniform vec2 uTexel;',
      'uniform float uRefract;',
      'uniform float uDarken;',
      'uniform float uTime;',
      'varying vec2 vUv;',
      'void main(){',
      '  float hL = texture2D(uRipple, vUv - vec2(uTexel.x, 0.0)).r;',
      '  float hR = texture2D(uRipple, vUv + vec2(uTexel.x, 0.0)).r;',
      '  float hT = texture2D(uRipple, vUv + vec2(0.0, uTexel.y)).r;',
      '  float hB = texture2D(uRipple, vUv - vec2(0.0, uTexel.y)).r;',
      '  float h  = texture2D(uRipple, vUv).r;',
      '  float dx = (hR - hL) * 0.5;',
      '  float dy = (hT - hB) * 0.5;',
      '  vec2 disp = vUv + vec2(dx, dy) * uRefract;',
      '  vec4 c = texture2D(uImg, disp);',
      '  c.rgb *= uDarken;',
      '  float spec = (h - 0.5) * 2.0;',
      '  c.rgb += vec3(spec * 0.15);',
      '  float vig = 1.0 - length(vUv - 0.5) * 0.8;',
      '  vig = clamp(vig, 0.0, 1.0);',
      '  c.rgb *= vig;',
      '  gl_FragColor = c;',
      '}'
    ].join('\n');

    var program = createProgram(vertSrc, fragSrc);
    if (!program) { fallbackPortal(portal); return; }

    // --- Geometry ---
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    var uImg = gl.getUniformLocation(program, 'uImg');
    var uRipple = gl.getUniformLocation(program, 'uRipple');
    var uTexel = gl.getUniformLocation(program, 'uTexel');
    var uRefract = gl.getUniformLocation(program, 'uRefract');
    var uDarken = gl.getUniformLocation(program, 'uDarken');

    // --- Ripple simulation (CPU) ---
    var simW = isDesktop ? 256 : 128;
    var simH = Math.round(simW * (window.innerHeight / window.innerWidth));
    var bufA = new Float32Array(simW * simH);
    var bufB = new Float32Array(simW * simH);
    var bufC = new Float32Array(simW * simH);
    for (var i = 0; i < bufA.length; i++) { bufA[i] = 0.5; bufB[i] = 0.5; bufC[i] = 0.5; }
    var rippleRGBA = new Uint8Array(simW * simH * 4);

    // --- Textures ---
    var rippleTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, rippleTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, simW, simH, 0, gl.RGBA, gl.UNSIGNED_BYTE, rippleRGBA);

    var imgTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20,20,18,255]));

    var heroImg = new Image();
    heroImg.onload = function () {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, heroImg);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      showPortalContent();
    };
    heroImg.src = './images/hero.jpg';

    // Show content after image or timeout
    var contentShown = false;
    var contentTimeout = setTimeout(showPortalContent, 3500);
    function showPortalContent() {
      if (contentShown) return;
      contentShown = true;
      clearTimeout(contentTimeout);
      var ct = portal.querySelector('.portal-content');
      if (ct) setTimeout(function () { ct.classList.add('portal-content-visible'); }, 400);
    }

    // --- Drop function ---
    function addDrop(cx, cy, radius, strength) {
      var r = Math.round(radius);
      var cxi = Math.round(cx), cyi = Math.round(cy);
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          var px = cxi + dx, py = cyi + dy;
          if (px < 0 || px >= simW || py < 0 || py >= simH) continue;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > r) continue;
          var f = (1.0 - dist / r); f = f * f;
          var idx = py * simW + px;
          bufA[idx] = Math.min(1.0, Math.max(0.0, bufA[idx] + f * strength));
        }
      }
    }

    // --- Mouse / Touch ---
    canvas.addEventListener('mousemove', function (e) {
      var x = (e.clientX / window.innerWidth) * simW;
      var y = (1.0 - e.clientY / window.innerHeight) * simH;
      addDrop(x, y, 4, 0.156);
    });
    canvas.addEventListener('mousedown', function (e) {
      var x = (e.clientX / window.innerWidth) * simW;
      var y = (1.0 - e.clientY / window.innerHeight) * simH;
      addDrop(x, y, 8, 0.455);
    });
    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      var t = e.touches[0];
      addDrop((t.clientX / window.innerWidth) * simW, (1.0 - t.clientY / window.innerHeight) * simH, 5, 0.234);
    }, { passive: false });
    canvas.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      addDrop((t.clientX / window.innerWidth) * simW, (1.0 - t.clientY / window.innerHeight) * simH, 7, 0.39);
    });

    // --- Auto drops ---
    var autoTimer = 0;
    function autoDrops(time) {
      if (time - autoTimer > 1800 + Math.random() * 2500) {
        autoTimer = time;
        addDrop(
          simW * 0.2 + Math.random() * simW * 0.6,
          simH * 0.2 + Math.random() * simH * 0.6,
          3 + Math.random() * 4,
          0.078 + Math.random() * 0.13
        );
      }
    }

    // --- Simulation step ---
    function simulate() {
      var damping = 0.985;
      for (var y = 1; y < simH - 1; y++) {
        for (var x = 1; x < simW - 1; x++) {
          var idx = y * simW + x;
          var avg = (bufA[idx - 1] + bufA[idx + 1] + bufA[idx - simW] + bufA[idx + simW]) * 0.5;
          bufC[idx] = 0.5 + (avg - bufB[idx] - 0.5) * damping;
        }
      }
      var tmp = bufB; bufB = bufA; bufA = bufC; bufC = tmp;
    }

    // --- Upload ripple to GPU ---
    function uploadRipple() {
      for (var i = 0; i < bufA.length; i++) {
        var v = Math.max(0, Math.min(255, Math.round(bufA[i] * 255)));
        var j = i * 4;
        rippleRGBA[j] = v; rippleRGBA[j+1] = v; rippleRGBA[j+2] = v; rippleRGBA[j+3] = 255;
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, rippleTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, simW, simH, gl.RGBA, gl.UNSIGNED_BYTE, rippleRGBA);
    }

    // --- Render loop ---
    var running = true;
    function render(time) {
      if (!running) return;
      autoDrops(time);
      simulate(); simulate();
      uploadRipple();

      gl.useProgram(program);
      gl.uniform1i(uImg, 0);
      gl.uniform1i(uRipple, 1);
      gl.uniform2f(uTexel, 1.0 / simW, 1.0 / simH);
      gl.uniform1f(uRefract, 0.065);
      gl.uniform1f(uDarken, 0.364);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    // --- Exit portal ---
    function exitPortal() {
      if (portal.classList.contains('portal-exiting')) return;
      // Final ripple burst
      for (var b = 0; b < 10; b++) {
        (function (delay) {
          setTimeout(function () {
            addDrop(
              simW * 0.25 + Math.random() * simW * 0.5,
              simH * 0.25 + Math.random() * simH * 0.5,
              5 + Math.random() * 5, 0.325 + Math.random() * 0.26
            );
          }, delay * 60);
        })(b);
      }
      portal.classList.add('portal-exiting');
      document.body.classList.remove('portal-active');

      setTimeout(function () {
        running = false;
        portal.style.display = 'none';
        gl.deleteTexture(imgTex);
        gl.deleteTexture(rippleTex);
        gl.deleteBuffer(buf);
        gl.deleteProgram(program);
      }, 1500);
    }

    var enterBtn = portal.querySelector('.portal-enter');
    if (enterBtn) enterBtn.addEventListener('click', exitPortal);

    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && contentShown && !portal.classList.contains('portal-exiting')) {
        e.preventDefault();
        exitPortal();
      }
    });
  }

  function fallbackPortal(portal) {
    var ct = portal.querySelector('.portal-content');
    if (ct) ct.classList.add('portal-content-visible');
    portal.classList.add('portal-fallback');
    setTimeout(function () {
      portal.classList.add('portal-exiting');
      document.body.classList.remove('portal-active');
      setTimeout(function () { portal.style.display = 'none'; }, 1500);
    }, 3000);
  }


  /* ================================================
   * 2. PAGE-WIDE WATER RIPPLE — Stir calm water
   * ============================================== */
  function initPageRipple() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var canvas = document.createElement('canvas');
    canvas.className = 'page-ripple';
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simulation grid — moderate res, CSS scales it up smoothly
    var simW = isDesktop ? 256 : 128;
    var simH = Math.round(simW * (window.innerHeight / window.innerWidth));
    if (simH < 48) simH = 48;

    var bufA = new Float32Array(simW * simH);
    var bufB = new Float32Array(simW * simH);
    var bufC = new Float32Array(simW * simH);
    for (var i = 0; i < bufA.length; i++) { bufA[i] = 0.5; bufB[i] = 0.5; bufC[i] = 0.5; }

    canvas.width = simW;
    canvas.height = simH;

    var imgData = ctx.createImageData(simW, simH);
    var pixels = imgData.data;

    // Mouse trail tracking
    var prevMX = -1, prevMY = -1;
    var prevTX = -1, prevTY = -1;
    var lastScroll = window.pageYOffset;

    function addDrop(cx, cy, radius, strength) {
      var r = Math.round(radius);
      var cxi = Math.round(cx), cyi = Math.round(cy);
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          var px = cxi + dx, py = cyi + dy;
          if (px < 0 || px >= simW || py < 0 || py >= simH) continue;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > r) continue;
          var f = (1.0 - dist / r); f = f * f;
          var idx = py * simW + px;
          bufA[idx] = Math.min(1.0, Math.max(0.0, bufA[idx] + f * strength));
        }
      }
    }

    // Interpolated trail — fills gaps between mouse events
    function addTrail(x0, y0, x1, y1, radius, strength) {
      var dx = x1 - x0, dy = y1 - y0;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var steps = Math.max(1, Math.round(dist / (radius * 0.4)));
      for (var s = 0; s <= steps; s++) {
        var t = s / steps;
        addDrop(x0 + dx * t, y0 + dy * t, radius, strength);
      }
    }

    function simulate() {
      var damping = 0.975;
      for (var y = 1; y < simH - 1; y++) {
        for (var x = 1; x < simW - 1; x++) {
          var idx = y * simW + x;
          var avg = (bufA[idx - 1] + bufA[idx + 1] + bufA[idx - simW] + bufA[idx + simW]) * 0.5;
          bufC[idx] = 0.5 + (avg - bufB[idx] - 0.5) * damping;
        }
      }
      var tmp = bufB; bufB = bufA; bufA = bufC; bufC = tmp;
    }

    function renderWater() {
      for (var y = 1; y < simH - 1; y++) {
        for (var x = 1; x < simW - 1; x++) {
          var idx = y * simW + x;
          // Surface normal from height gradient
          var nx = (bufA[idx + 1] - bufA[idx - 1]);
          var ny = (bufA[idx + simW] - bufA[idx - simW]);

          // Directional light from top-left — simulates light on water
          var light = (nx * 1.0 + ny * 0.8) * 4.0;

          // Sharpen into specular highlight (quadratic, keeps sign)
          var spec = light * light * (light > 0 ? 1 : -1) * 0.3;

          // 128 = neutral in overlay blend (invisible), brighter/darker = visible
          var v = Math.max(0, Math.min(255, 128 + Math.round(spec * 220)));

          // Alpha proportional to disturbance — calm areas stay invisible
          var disturbance = Math.abs(light);
          var alpha = Math.min(255, Math.round(disturbance * 250));

          var j = idx * 4;
          pixels[j]     = v;
          pixels[j + 1] = v;
          pixels[j + 2] = Math.min(255, v + 10); // slight cool tint
          pixels[j + 3] = alpha;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // --- Mouse: continuous trail of drops ---
    document.addEventListener('mousemove', function (e) {
      if (document.body.classList.contains('portal-active')) return;
      var mx = (e.clientX / window.innerWidth) * simW;
      var my = (e.clientY / window.innerHeight) * simH;
      if (prevMX >= 0) {
        addTrail(prevMX, prevMY, mx, my, 5, 0.06);
      } else {
        addDrop(mx, my, 5, 0.05);
      }
      prevMX = mx;
      prevMY = my;
    });

    document.addEventListener('mouseleave', function () {
      prevMX = -1; prevMY = -1;
    });

    // Click = big splash
    document.addEventListener('click', function (e) {
      if (document.body.classList.contains('portal-active')) return;
      var x = (e.clientX / window.innerWidth) * simW;
      var y = (e.clientY / window.innerHeight) * simH;
      addDrop(x, y, 10, 0.175);
    });

    // Scroll creates ambient waves
    window.addEventListener('scroll', function () {
      if (document.body.classList.contains('portal-active')) return;
      var scrollY = window.pageYOffset;
      var delta = Math.abs(scrollY - lastScroll);
      lastScroll = scrollY;
      if (delta > 2) {
        var strength = Math.min(0.05, delta * 0.002);
        addDrop(Math.random() * simW, Math.random() * simH, 5, strength);
        if (delta > 12) {
          addDrop(Math.random() * simW, Math.random() * simH, 4, strength * 0.6);
        }
        if (delta > 30) {
          addDrop(Math.random() * simW, Math.random() * simH, 4.5, strength * 0.5);
        }
      }
    }, { passive: true });

    // Touch: trail like finger through water
    document.addEventListener('touchmove', function (e) {
      if (document.body.classList.contains('portal-active')) return;
      var t = e.touches[0];
      if (!t) return;
      var tx = (t.clientX / window.innerWidth) * simW;
      var ty = (t.clientY / window.innerHeight) * simH;
      if (prevTX >= 0) {
        addTrail(prevTX, prevTY, tx, ty, 5, 0.05);
      } else {
        addDrop(tx, ty, 5, 0.04);
      }
      prevTX = tx; prevTY = ty;
    }, { passive: true });

    document.addEventListener('touchend', function () {
      prevTX = -1; prevTY = -1;
    });

    // Render loop
    function loop() {
      if (!document.body.classList.contains('portal-active')) {
        simulate();
        simulate(); // double step — ripples spread faster
        renderWater();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }


  /* ================================================
   * CORE FUNCTIONS — Clean, polished interactions
   * ============================================== */

  function hideDecorativeSVGs() {
    var svgs = document.querySelectorAll('svg:not([role="img"])');
    for (var i = 0; i < svgs.length; i++) {
      if (!svgs[i].getAttribute('aria-label') && !svgs[i].getAttribute('aria-labelledby')) {
        svgs[i].setAttribute('aria-hidden', 'true');
      }
    }
  }

  function initNavScroll() {
    var nav = document.querySelector('nav');
    if (!nav) return;
    function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 60); }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function initHamburger() {
    var toggle = document.getElementById('hamburger') || document.querySelector('.hamburger');
    var menu = document.getElementById('navLinks') || document.querySelector('.nav-links');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', function () {
      var isOpen = menu.classList.toggle('open');
      toggle.classList.toggle('active');
      toggle.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    var links = menu.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function () {
        toggle.setAttribute('aria-expanded', 'false');
        menu.classList.remove('open');
        toggle.classList.remove('active');
        document.body.style.overflow = '';
      });
    }
  }

  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href');
      if (id === '#' || !id) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('animate-in');
          observer.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.12 });
    var els = document.querySelectorAll('[data-animate]');
    for (var j = 0; j < els.length; j++) observer.observe(els[j]);
  }

  function initCookieBanner() {
    var key = 'cookies_accepted';
    try { if (localStorage.getItem(key)) return; } catch (e) {}
    var banner = document.getElementById('cookieBanner');
    if (!banner) return;
    banner.style.display = '';
    requestAnimationFrame(function () { banner.classList.add('visible'); });
    var btn = document.getElementById('cookieAccept');
    if (btn) btn.addEventListener('click', function () {
      banner.classList.remove('visible');
      try { localStorage.setItem(key, '1'); } catch (e) {}
    });
  }

  function initScrollProgress() {
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);
    window.addEventListener('scroll', function () {
      var top = window.pageYOffset;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (top / h) * 100 : 0) + '%';
    }, { passive: true });
  }

  function initStaggerReveal() {
    if (!('IntersectionObserver' in window)) return;
    var containers = document.querySelectorAll('[data-stagger-parent]');
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          var children = entries[i].target.querySelectorAll('[data-stagger]');
          for (var j = 0; j < children.length; j++) {
            (function (child, idx) {
              setTimeout(function () { child.classList.add('stagger-in'); }, idx * 120);
            })(children[j], j);
          }
          observer.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.15 });
    for (var k = 0; k < containers.length; k++) observer.observe(containers[k]);
  }

  function initSectionFade() {
    if (!('IntersectionObserver' in window)) return;
    var sections = document.querySelectorAll('.section, .section-alt');
    for (var i = 0; i < sections.length; i++) sections[i].classList.add('section-fade');
    var observer = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].isIntersecting) entries[j].target.classList.add('section-visible');
      }
    }, { threshold: 0.06 });
    for (var k = 0; k < sections.length; k++) observer.observe(sections[k]);
  }

  function initDivisionCards() {
    var cards = document.querySelectorAll('.division-card');
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        if (!card.querySelector('.division-expand-hint')) return;
        card.style.cursor = 'pointer';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.addEventListener('click', function () {
          var wasExp = card.classList.contains('division-expanded');
          var all = document.querySelectorAll('.division-card');
          for (var j = 0; j < all.length; j++) all[j].classList.remove('division-expanded');
          if (!wasExp) card.classList.add('division-expanded');
        });
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
        });
      })(cards[i]);
    }
  }

  function initNavHighlight() {
    if (!('IntersectionObserver' in window)) return;
    var sections = document.querySelectorAll('section[id]');
    var navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          var id = entries[i].target.getAttribute('id');
          for (var j = 0; j < navLinks.length; j++) {
            navLinks[j].classList.remove('nav-active');
            if (navLinks[j].getAttribute('href') === '#' + id) navLinks[j].classList.add('nav-active');
          }
        }
      }
    }, { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' });
    for (var k = 0; k < sections.length; k++) observer.observe(sections[k]);
  }

  function initCounters() {
    var counters = document.querySelectorAll('[data-count]');
    if (!counters.length || !('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          animateCounter(entries[i].target);
          observer.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.5 });
    for (var j = 0; j < counters.length; j++) observer.observe(counters[j]);
  }

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    var suffix = el.getAttribute('data-suffix') || '';
    var sep = el.getAttribute('data-separator') || '';
    var duration = 2000;
    var start = null;
    function formatNum(n) {
      if (!sep) return String(n);
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    }
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(2, -10 * p);
      el.textContent = formatNum(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initImageReveal() {
    var images = document.querySelectorAll('.hotel-gallery-hero, .split-image, .living-showcase-image, .living-room-image');
    if (!images.length || !('IntersectionObserver' in window)) return;
    for (var i = 0; i < images.length; i++) images[i].classList.add('img-reveal');
    var observer = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].isIntersecting) {
          entries[j].target.classList.add('img-revealed');
          observer.unobserve(entries[j].target);
        }
      }
    }, { threshold: 0.15 });
    for (var k = 0; k < images.length; k++) observer.observe(images[k]);
  }

  function initGalleryLightbox() {
    var overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML =
      '<div class="lightbox-inner"><img src="" alt="">' +
      '<button class="lightbox-close" aria-label="Close">&times;</button>' +
      '<div class="lightbox-counter"></div></div>';
    document.body.appendChild(overlay);

    var lbImg = overlay.querySelector('img');
    var closeBtn = overlay.querySelector('.lightbox-close');
    var counter = overlay.querySelector('.lightbox-counter');
    var allImgs = [];
    var curIdx = 0;

    function open(src, alt, idx) {
      lbImg.src = src; lbImg.alt = alt || '';
      curIdx = idx;
      counter.textContent = (idx + 1) + ' / ' + allImgs.length;
      overlay.classList.add('lightbox-active');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      overlay.classList.remove('lightbox-active');
      document.body.style.overflow = '';
    }
    function nav(dir) {
      curIdx = (curIdx + dir + allImgs.length) % allImgs.length;
      lbImg.style.opacity = '0';
      setTimeout(function () {
        lbImg.src = allImgs[curIdx].src;
        lbImg.alt = allImgs[curIdx].alt;
        counter.textContent = (curIdx + 1) + ' / ' + allImgs.length;
        lbImg.style.opacity = '1';
      }, 200);
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
      if (e.target === lbImg) {
        var r = lbImg.getBoundingClientRect();
        e.clientX < r.left + r.width / 2 ? nav(-1) : nav(1);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('lightbox-active')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') nav(-1);
      if (e.key === 'ArrowRight') nav(1);
    });

    var imgs = document.querySelectorAll('.hotel-gallery-hero img, .hotel-gallery-thumb img');
    for (var i = 0; i < imgs.length; i++) {
      allImgs.push(imgs[i]);
      imgs[i].style.cursor = 'zoom-in';
      (function (img, idx) {
        img.addEventListener('click', function () { open(img.src, img.alt, idx); });
      })(imgs[i], i);
    }
  }

  function initTextReveal() {
    var headings = document.querySelectorAll('[data-text-reveal]');
    for (var i = 0; i < headings.length; i++) {
      var el = headings[i];
      var text = el.textContent;
      var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
      el.innerHTML = '';
      el.classList.add('text-reveal-ready');
      var wordIndex = 0;
      for (var li = 0; li < lines.length; li++) {
        var words = lines[li].split(' ');
        for (var j = 0; j < words.length; j++) {
          var span = document.createElement('span');
          span.className = 'text-reveal-word';
          span.textContent = words[j];
          span.style.transitionDelay = (wordIndex * 0.06) + 's';
          el.appendChild(span);
          if (j < words.length - 1) el.appendChild(document.createTextNode(' '));
          wordIndex++;
        }
        if (li < lines.length - 1) el.appendChild(document.createElement('br'));
      }
    }
    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      for (var m = 0; m < entries.length; m++) {
        if (entries[m].isIntersecting) {
          entries[m].target.classList.add('text-reveal-visible');
          observer.unobserve(entries[m].target);
        }
      }
    }, { threshold: 0.2 });
    var els = document.querySelectorAll('.text-reveal-ready');
    for (var n = 0; n < els.length; n++) observer.observe(els[n]);
  }


  /* ================================================
   * INIT
   * ============================================== */
  function init() {
    initPortal();
    // initPageRipple(); // Removed: water ripple effect disabled
    hideDecorativeSVGs();
    initNavScroll();
    initHamburger();
    initSmoothScroll();
    initScrollAnimations();
    initCookieBanner();
    initScrollProgress();
    initStaggerReveal();
    initSectionFade();
    initDivisionCards();
    initNavHighlight();
    initCounters();
    initImageReveal();
    initGalleryLightbox();
    initTextReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
