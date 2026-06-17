// ── Viz compositor height sync ────────────────────────────────────
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'viz-height') {
    var wrap = document.querySelector('.viz-embed-wrap');
    if (wrap) wrap.style.height = (e.data.height + 2) + 'px';
  }
});

// ── Plot zoom lightbox ──────────────────────────────────────────────
// The compositor (viz_compositor.html) lives in its own nested iframe, so
// `position: fixed` computed *inside* it is relative to that small iframe's
// own viewport, not the actual browser window — centering there can land
// off-screen relative to what the user is really looking at. So the floating
// zoomed plot lives up here, in the top-level page, and the compositor (a
// same-origin iframe) just calls these directly to open/close it, passing
// along the plot's URL and its on-screen origin rect.
(function () {
  var PEASE = 'cubic-bezier(.25,.46,.45,.94)';
  var PAD   = 40;

  var backdrop = null, frame = null, label = null, closeCb = null, leaveTimer = null;

  function ensure() {
    if (frame) return;
    backdrop = document.createElement('div');
    backdrop.className = 'pfocus-backdrop';
    document.body.appendChild(backdrop);
    frame = document.createElement('iframe');
    frame.className = 'pfocus-frame';
    document.body.appendChild(frame);
    label = document.createElement('div');
    label.className = 'pfocus-label';
    document.body.appendChild(label);
  }

  function place(r) {
    frame.style.transition = 'none';
    frame.style.left = r.left + 'px'; frame.style.top = r.top + 'px';
    frame.style.width = r.width + 'px'; frame.style.height = r.height + 'px';
  }

  function transitionStr(ms) {
    return ['left', 'top', 'width', 'height'].map(function (p) {
      return p + ' ' + ms + 'ms ' + PEASE;
    }).join(', ');
  }

  window.__plotZoomOpen = function (src, origin, onClosed, mode, title) {
    ensure();
    clearTimeout(leaveTimer);
    closeCb = onClosed;
    frame.style.display = 'block';
    frame.style.pointerEvents = 'none';
    place(origin);
    var srcChanged = frame.src !== src;
    if (srcChanged) frame.src = src;
    backdrop.classList.add('active');
    frame.dataset.origin = JSON.stringify(origin);

    // Show model name label
    label.textContent = title || '';
    label.style.display = title ? 'block' : 'none';

    // Send mode to the iframe once it's ready
    if (mode) {
      function sendMode() {
        try { frame.contentWindow.postMessage({ action: 'setMode', mode: mode }, '*'); } catch(e) {}
      }
      if (srcChanged) {
        frame.onload = function () { setTimeout(sendMode, 80); frame.onload = null; };
      } else {
        setTimeout(sendMode, 80);
      }
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var maxW = window.innerWidth  - PAD * 2;
        var maxH = window.innerHeight - PAD * 2;
        var w = Math.max(280, maxW);
        var h = Math.min(maxH, w * 10 / 16);
        w = Math.min(w, h * 16 / 10);
        var l = (window.innerWidth  - w) / 2;
        var t = (window.innerHeight - h) / 2;
        frame.style.transition = transitionStr(280);
        frame.style.left = l + 'px'; frame.style.top = t + 'px';
        frame.style.width = w + 'px'; frame.style.height = h + 'px';
        // Position label above frame
        label.style.left = l + 'px';
        label.style.top  = (t - 34) + 'px';
        label.style.width = w + 'px';
        setTimeout(function () { frame.style.pointerEvents = 'auto'; }, 290);
      });
    });
  };

  window.__plotZoomClose = function () {
    if (!frame || frame.style.display === 'none') return;
    frame.style.pointerEvents = 'none';
    var origin = JSON.parse(frame.dataset.origin || '{}');
    frame.style.transition = transitionStr(220);
    frame.style.left = (origin.left || 0) + 'px'; frame.style.top = (origin.top || 0) + 'px';
    frame.style.width = (origin.width || 0) + 'px'; frame.style.height = (origin.height || 0) + 'px';
    backdrop.classList.remove('active');
    setTimeout(function () {
      frame.style.display = 'none';
      if (label) label.style.display = 'none';
      if (closeCb) { var cb = closeCb; closeCb = null; cb(); }
    }, 220);
  };

  // Closing on "moved away": same live-rect-check approach as the compositor
  // uses internally — robust against the frame having physically moved away
  // from a stationary cursor during the open animation.
  document.addEventListener('mousemove', function (e) {
    if (!frame || frame.style.display === 'none') return;
    var r = frame.getBoundingClientRect();
    var inside = e.clientX >= r.left && e.clientX <= r.right &&
                 e.clientY >= r.top  && e.clientY <= r.bottom;
    if (inside) {
      clearTimeout(leaveTimer); leaveTimer = null;
    } else if (!leaveTimer) {
      leaveTimer = setTimeout(function () {
        leaveTimer = null;
        window.__plotZoomClose();
      }, 150);
    }
  });
})();

// ── Scroll progress rail ──────────────────────────────────────────
var rail = document.getElementById('progress-rail');
window.addEventListener('scroll', function () {
  var h = document.documentElement;
  rail.style.width = Math.min(100, (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100) + '%';
}, { passive: true });

// ── Reveal on scroll ──────────────────────────────────────────────
(function () {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.07 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  // Hero title + sub animations — fire once when hero enters view
  var hero = document.getElementById('hero');
  if (hero) {
    var heroIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in-view'); heroIO.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    heroIO.observe(hero);
  }
})();

// ── Task video speed ──────────────────────────────────────────────
document.querySelectorAll('.task-video').forEach(function (v) {
  v.playbackRate = 1.8;
  v.addEventListener('loadedmetadata', function () { v.playbackRate = 1.8; });
});

// ── Skill data ────────────────────────────────────────────────────
var SKILLS = {
  lamp: [
    {
      name: 'Reach Bulb', mod: 'V', ptype: 'Cont.',
      terminal: 'End-effector reaches the bulb region.',
      desc: 'A visually-guided reaching motion. CLIP ViT encodes the scene and localizes the bulb. Tactile not yet informative.',
      video: 'videos/reach_bulb.mp4'
    },
    {
      name: 'Grasp Bulb', mod: 'T', ptype: 'Cont.',
      terminal: 'Stable grasp is established on the bulb.',
      desc: 'Contact initiation and grasp stability are primarily indicated by tactile force readings as the fingers close around the bulb.',
      video: 'videos/grasp_bulb.mp4',
      tac1: 'videos/grasp_bulb_tactile1.mp4', tac2: 'videos/grasp_bulb_tactile2.mp4'
    },
    {
      name: 'Reach Socket', mod: 'V', ptype: 'Cont.',
      terminal: 'End-effector reaches the socket region while holding the bulb.',
      desc: 'Transport phase. Visual guidance navigates to the lamp socket; tactile signal remains stable (holding grasp).',
      video: 'videos/reach_lamp_socket.mp4',
      tac1: 'videos/reach_lamp_socket_tactile1.mp4', tac2: 'videos/reach_lamp_socket_tactile2.mp4'
    },
    {
      name: 'Align Bulb', mod: 'V+T', ptype: 'Disc.',
      terminal: 'Bulb is aligned with the socket opening.',
      desc: 'Both vision and tactile contribute: vision checks spatial alignment while tactile detects initial contact with socket edges. Discrete completion.',
      video: 'videos/align_bulb.mp4',
      tac1: 'videos/align_bulb_tactile1.mp4', tac2: 'videos/align_bulb_tactile2.mp4'
    },
    {
      name: 'Twist Bulb', mod: 'T', ptype: 'Disc.',
      terminal: 'Bulb reaches end of thread — increased tactile force.',
      desc: 'Completion is <em>invisible</em> to vision. The bulb reaches the mechanical stop only detectable as a sharp increase in rotational force via tactile sensors.',
      video: 'videos/twist_bulb.mp4',
      tac1: 'videos/twist_bulb_last_tactile1.mp4', tac2: 'videos/twist_bulb_last_tactile2.mp4'
    },
  ],
  bottle: [
    {
      name: 'Reach Cap', mod: 'V', ptype: 'Cont.',
      terminal: 'End-effector reaches the target cap.',
      desc: 'Scene-level localization of the bottle cap using CLIP ViT global scene representation.',
      video: 'videos/reach bottle cap.mp4'
    },
    {
      name: 'Grasp Cap', mod: 'T', ptype: 'Cont.',
      terminal: 'Stable grasp established on the cap.',
      desc: 'Grasp quality is sensed tactilely — force distribution across fingertips confirms stable hold.',
      video: 'videos/grasp bottle cap.mp4',
      tac1: 'videos/grasb_bottle_cap_tactile1.mp4', tac2: 'videos/grasb_bottle_cap_tactile2.mp4'
    },
    {
      name: 'Reach Bottle', mod: 'V', ptype: 'Cont.',
      terminal: 'End-effector reaches the bottle opening while holding the cap.',
      desc: 'Visual navigation to the bottle neck. Position of the bottle opening is estimated from RGB.',
      video: 'videos/reach bottle.mp4',
      tac1: 'videos/reach_bottle_tactile1.mp4', tac2: 'videos/reach_bottle_tactile2.mp4'
    },
    {
      name: 'Align Cap', mod: 'V+T', ptype: 'Disc.',
      terminal: 'Cap is aligned with the bottle opening.',
      desc: 'Fine alignment uses both visual positioning and tactile contact onset to confirm seating.',
      video: 'videos/align bottle cap.mp4',
      tac1: 'videos/align_bottle_cap_tactile1.mp4', tac2: 'videos/align_bottle_cap_tactile2.mp4'
    },
    {
      name: 'Slide Cap', mod: 'T', ptype: 'Cond.',
      terminal: 'Cap slides until slippage is detected.',
      desc: 'The most tactile-dominant skill. Slippage — a transient force pattern — must be detected from FeelAnyForce tokens. Vision shows no useful signal during this phase. Conditional: progress resets to −1 on cap loss.',
      video: 'videos/slide bottle cap.mp4',
      tac1: 'videos/slide_bottle_cap_last_tactile1.mp4', tac2: 'videos/slide_bottle_cap_last_tactile2.mp4'
    },
  ],
  blind: [
    {
      name: 'Reach Box 1', mod: 'V', ptype: 'Cont.',
      terminal: 'End-effector reaches the first candidate box region.',
      desc: 'Visual guidance to the first candidate box. Spatial position from RGB; no contact yet.',
      video: 'videos/reach_box1.mp4'
    },
    {
      name: 'Inspect Box 1', mod: 'T', ptype: 'Cond.',
      terminal: 'Tactile deformation confirms cube vs. no cube.',
      desc: 'The critical tactile inference: FeelAnyForce must distinguish between a cube (sharp corners, rigid deformation) and background from contact geometry alone. Progress reaches 1 on positive detection, −1 on failure.',
      video: 'videos/inspect_box1.mp4',
      tac1: 'videos/inspect_box_1_tactile1.mp4', tac2: 'videos/inspect_box_1_tactile2.mp4',
      ringColor: '#e03030', nodeClass: 'node-failed'
    },
    {
      name: 'Withdraw 1', mod: 'V', ptype: 'Cont.',
      terminal: 'End-effector leaves the interaction region.',
      desc: 'Retreat motion after the first inspection. Visually guided; event memory preserves the outcome of inspect box 1 for the next skill.',
      video: 'videos/withdraw1.mp4'
    },
    {
      name: 'Reach Box 2', mod: 'V', ptype: 'Cont.',
      terminal: 'End-effector reaches the second candidate box region.',
      desc: 'Visual guidance to the second candidate box, conditioned on the negative outcome stored in event memory.',
      video: 'videos/reach_box2.mp4'
    },
    {
      name: 'Inspect Box 2', mod: 'T', ptype: 'Cond.',
      terminal: 'Tactile deformation confirms cube in the second box.',
      desc: 'Tactile inference on the second box. Event memory from the first inspection biases the model toward finding the cube here.',
      video: 'videos/inspect_box2.mp4',
      tac1: 'videos/inspect_box_2_tactile1.mp4', tac2: 'videos/inspect_box_2_tactile2.mp4',
      nodeClass: 'node-success'
    },
    {
      name: 'Reach Puzzle Box', mod: 'V', ptype: 'Cont.',
      terminal: 'End-effector reaches the puzzle box while holding the cube.',
      desc: 'After the cube is found, visually navigate to the insertion target.',
      video: 'videos/reach_puzzle_box.mp4'
    },
    {
      name: 'Insert Cube', mod: 'V+T', ptype: 'Cont.',
      terminal: 'Cube inserted into the square hole.',
      desc: 'Final insertion requires visual alignment and tactile confirmation of seating. Both modalities contribute to detecting successful placement.',
      video: 'videos/insert_cube.mp4'
    },
  ],
};

// ── Build timelines ───────────────────────────────────────────────
function modBadge(mod) {
  var cls = mod === 'V' ? 'mod-v' : mod === 'T' ? 'mod-t' : 'mod-vt';
  return '<span class="mod-badge ' + cls + '">' + mod + '</span>';
}

function ptypeBadge(pt) {
  var cls = pt === 'Cont.' ? 'ptype-cont' : pt === 'Disc.' ? 'ptype-disc' : 'ptype-cond';
  return '<span class="ptype-badge ' + cls + '">' + pt + '</span>';
}

var TRANSITION_MS = 750;

function buildTimeline(taskKey, color, onComplete) {
  var skills  = SKILLS[taskKey];
  var nodesEl = document.getElementById(taskKey + '-nodes');
  var detail  = document.getElementById(taskKey + '-detail');
  if (!nodesEl || !detail) return { start: function(){}, stop: function(){} };

  var activeIdx       = -1;
  var advanceTimer    = null;
  var paused          = false;
  var curVideo        = null;
  var tacVidsCurrent  = null;
  var timerWasActive  = false;
  var timerStart      = 0;
  var remaining       = 0;
  var inTactilePhase  = false;
  var generation      = 0;

  function stopAdvance() {
    if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
  }

  function doAdvance() {
    stopAdvance();
    if (!inTactilePhase) {
      // video phase just ended — reveal tactile if present
      inTactilePhase = true;
      var tacEl = detail.querySelector('.detail-tactile');
      if (tacEl) {
        tacEl.classList.add('visible');
        var myGen = generation;
        // Draw animated path from bullet → down → around tactile section
        requestAnimationFrame(function () {
          if (generation !== myGen) return;
          var info  = detail.querySelector('.detail-info');
          var dot   = detail.querySelector('.tac-origin-dot');
          var vidEl = tacEl.querySelector('.detail-tactile-videos');
          if (!info || !dot || !vidEl) return;
          info.style.position = 'relative';
          var iR  = info.getBoundingClientRect();
          var dR  = dot.getBoundingClientRect();
          var tR  = tacEl.getBoundingClientRect();
          var vR  = vidEl.getBoundingClientRect();
          var tH  = tacEl.scrollHeight;
          var pad = 3;
          var r   = 6;
          var cx  = dR.left + dR.width  / 2 - iR.left;
          var cy  = dR.top  + dR.height / 2 - iR.top;
          var tx  = vR.left  - iR.left - pad;
          var trx = vR.right - iR.left + pad;
          var ty  = tR.top   - iR.top  - pad;
          var tby = tR.top   - iR.top  + tH + pad;
          // left → down → right along top → CW border
          var lx = -3; // left stop: extend left past the info column edge
          var d = 'M ' + cx + ' ' + cy
            + ' L ' + lx + ' ' + cy
            + ' L ' + lx + ' ' + (ty + r)
            + ' Q ' + lx + ' ' + ty + ' ' + (lx + r) + ' ' + ty
            + ' L ' + (trx - r) + ' ' + ty
            + ' Q ' + trx + ' ' + ty + ' ' + trx + ' ' + (ty + r)
            + ' L ' + trx + ' ' + (tby - r)
            + ' Q ' + trx + ' ' + tby + ' ' + (trx - r) + ' ' + tby
            + ' L ' + (tx + r) + ' ' + tby
            + ' Q ' + tx + ' ' + tby + ' ' + tx + ' ' + (tby - r)
            + ' L ' + tx + ' ' + (ty + r)
            + ' Q ' + tx + ' ' + ty + ' ' + (tx + r) + ' ' + ty
            + ' L ' + (lx + r) + ' ' + ty;
          var NS   = 'http://www.w3.org/2000/svg';
          var svg  = document.createElementNS(NS, 'svg');
          svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:5;';
          var path = document.createElementNS(NS, 'path');
          path.setAttribute('d', d);
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', '#f0922b');
          path.setAttribute('stroke-width', '2');
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('stroke-linejoin', 'round');
          svg.appendChild(path);
          info.appendChild(svg);
          var len = path.getTotalLength();
          path.style.strokeDasharray = len;
          path.style.strokeDashoffset = len;
          path.getBoundingClientRect();
          path.style.transition = 'stroke-dashoffset .8s ease';
          path.style.strokeDashoffset = '0';
        });
        var tacVids = tacEl.querySelectorAll('.detail-tac-video');
        tacVidsCurrent = tacVids;
        var done    = 0;
        tacVids.forEach(function (v) {
          var plays = 0;
          v.playbackRate = 1/9;
          v.play().catch(function () {
            if (generation === myGen && inTactilePhase && ++done >= tacVids.length) scheduleAdvance(TRANSITION_MS);
          });
          v.addEventListener('ended', function onEnd() {
            if (generation !== myGen || !inTactilePhase) return;
            plays++;
            if (plays < 3) {
              v.currentTime = 0;
              v.play().catch(function () { v.removeEventListener('ended', onEnd); if (++done >= tacVids.length) scheduleAdvance(TRANSITION_MS); });
            } else {
              v.removeEventListener('ended', onEnd);
              if (++done >= tacVids.length) scheduleAdvance(TRANSITION_MS);
            }
          });
          v.addEventListener('error', function () {
            if (generation === myGen && inTactilePhase && ++done >= tacVids.length) scheduleAdvance(TRANSITION_MS);
          }, { once: true });
        });
        return; // wait for tactile videos to finish
      }
      scheduleAdvance(TRANSITION_MS);
      return;
    }
    // tactile phase done — advance
    inTactilePhase = false;
    var next = activeIdx + 1;
    if (next >= skills.length) {
      // last subtask finished — notify parent to switch task
      if (typeof onComplete === 'function') { onComplete(); return; }
      next = 0;
    }
    playIdx(next);
  }

  function scheduleAdvance(ms) {
    stopAdvance();
    remaining  = ms;
    timerStart = Date.now();
    advanceTimer = setTimeout(doAdvance, ms);
  }

  function ringStart(dur) {
    var cur = nodesEl.querySelectorAll('.tnode')[activeIdx];
    if (!cur) return;
    var fill = cur.querySelector('.tnode-ring-fill');
    if (!fill) return;
    var rc = skills[activeIdx] && skills[activeIdx].ringColor;
    fill.style.stroke = rc || '';
    fill.style.animation = 'none';
    fill.style.strokeDashoffset = '256';
    void fill.offsetWidth;
    fill.style.animation = 'ring-sweep ' + dur + 's linear forwards';
    cur.classList.add('playing');
  }

  detail.addEventListener('mouseenter', function () {
    if (paused) return;
    paused = true;
    timerWasActive = !!advanceTimer;
    if (timerWasActive) remaining = Math.max(0, remaining - (Date.now() - timerStart));
    stopAdvance();
    if (curVideo && !curVideo.ended) curVideo.pause();
    if (tacVidsCurrent) {
      tacVidsCurrent.forEach(function (v) { if (!v.ended) v.pause(); });
    }
    var cur = nodesEl.querySelectorAll('.tnode')[activeIdx];
    if (cur) {
      var fill = cur.querySelector('.tnode-ring-fill');
      if (fill) fill.style.animationPlayState = 'paused';
    }
  });

  detail.addEventListener('mouseleave', function () {
    if (!paused) return;
    paused = false;
    if (curVideo && !curVideo.ended) curVideo.play();
    if (tacVidsCurrent) {
      tacVidsCurrent.forEach(function (v) { if (!v.ended) v.play().catch(function () {}); });
    }
    var cur = nodesEl.querySelectorAll('.tnode')[activeIdx];
    if (cur) {
      var fill = cur.querySelector('.tnode-ring-fill');
      if (fill) fill.style.animationPlayState = 'running';
    }
    if (timerWasActive) scheduleAdvance(remaining);
  });

  function renderDetail(sk) {
    var tacHtml = sk.tac1 ? (
      '<div class="detail-tactile">' +
        '<div class="detail-tactile-label">Tactile readings</div>' +
        '<div class="detail-tactile-videos">' +
          '<div class="detail-tac-wrap">' +
            '<video class="detail-tac-video" src="' + sk.tac2 + '" muted playsinline preload="auto"></video>' +
            '<span class="detail-tac-tag">Left</span>' +
          '</div>' +
          '<div class="detail-tac-wrap">' +
            '<video class="detail-tac-video" src="' + sk.tac1 + '" muted playsinline preload="auto"></video>' +
            '<span class="detail-tac-tag">Right</span>' +
          '</div>' +
        '</div>' +
      '</div>'
    ) : '';
    detail.innerHTML =
      '<div class="skill-detail-inner">' +
        '<div class="detail-video-wrap">' +
          '<video class="detail-video" src="' + sk.video + '" autoplay muted playsinline></video>' +
        '</div>' +
        '<div class="detail-info">' +
          '<div class="detail-skill-name">' + sk.name + '</div>' +
          '<div class="detail-badges">' + ptypeBadge(sk.ptype) + '</div>' +
          '<div class="detail-terminal">' + (sk.tac1 ? '<span class="tac-origin-dot"></span>' : '') + '<strong>Terminal condition:</strong> ' + sk.terminal + '</div>' +
          tacHtml +
          '<div class="detail-terminal">' + sk.desc + '</div>' +
        '</div>' +
      '</div>';
    detail.classList.add('open');
  }

  function playIdx(i) {
    generation++;
    inTactilePhase = false;
    stopAdvance();
    if (curVideo) { curVideo.pause(); curVideo = null; }
    tacVidsCurrent = null;
    activeIdx = i;
    paused = false;

    var allNodes = nodesEl.querySelectorAll('.tnode');

    allNodes.forEach(function (n, idx) {
      var fill = n.querySelector('.tnode-ring-fill');
      var nc = skills[idx] && skills[idx].nodeClass;
      if (idx > i) {
        // future nodes: clear completed/playing rings
        n.classList.remove('completed', 'active', 'playing', 'node-failed', 'node-success');
        if (fill) { fill.style.stroke = ''; fill.style.animation = 'none'; fill.style.strokeDashoffset = '256'; void fill.offsetWidth; fill.style.animation = ''; }
      } else if (idx === i) {
        // new active node: clear ring, set active
        n.classList.remove('completed', 'playing', 'node-failed', 'node-success');
        n.classList.add('active');
        if (fill) { fill.style.stroke = ''; fill.style.animation = 'none'; fill.style.strokeDashoffset = '256'; void fill.offsetWidth; }
      } else {
        // past nodes: snap ring to full and mark completed
        n.classList.remove('active', 'playing');
        n.classList.add('completed');
        if (nc) n.classList.add(nc);
        if (fill) {
          var rc = skills[idx] && skills[idx].ringColor;
          fill.style.stroke = rc || '';
          fill.style.animation = 'none'; fill.style.strokeDashoffset = '0'; void fill.offsetWidth;
        }
      }
    });

    var cur = allNodes[i];
    if (cur) {
      var fill = cur.querySelector('.tnode-ring-fill');
      var strip = nodesEl.closest('.timeline-scroll');
      if (strip) { strip.scrollTo({ left: cur.offsetLeft + cur.offsetWidth / 2 - strip.clientWidth / 2, behavior: 'smooth' }); }
      var nodeCenter = cur.offsetLeft + cur.offsetWidth / 2 - (strip ? strip.scrollLeft : 0);
      detail.style.setProperty('--arrow-x', nodeCenter + 'px');
    }

    renderDetail(skills[i]);

    curVideo = detail.querySelector('.detail-video');
    if (curVideo) {
      var onMeta = function () {
        var dur = curVideo && curVideo.duration;
        if (!dur || !isFinite(dur)) return;
        ringStart(dur);
        scheduleAdvance(dur * 1000);
      };
      if (curVideo.readyState >= 1 && isFinite(curVideo.duration)) {
        onMeta();
      } else {
        curVideo.addEventListener('loadedmetadata', onMeta, { once: true });
      }
    }
  }

  skills.forEach(function (sk, i) {
    var node = document.createElement('div');
    node.className = 'tnode';
    node.style.setProperty('--i', i);
    node.innerHTML =
      '<div class="tnode-circle">' +
        '<span class="tnode-idx">' + sk.name + '</span>' +
        '<svg class="tnode-ring" viewBox="0 0 102 62" width="102" height="62">' +
          '<rect class="tnode-ring-track" x="3" y="3" width="96" height="56" rx="28"/>' +
          '<rect class="tnode-ring-fill"  x="3" y="3" width="96" height="56" rx="28"/>' +
        '</svg>' +
      '</div>' +
      '<div class="tnode-badges">' + ptypeBadge(sk.ptype) + '</div>';
    node.addEventListener('click', function () { playIdx(i); });
    nodesEl.appendChild(node);
  });

  function restart() {
    var nodes = nodesEl.querySelectorAll('.tnode');
    nodes.forEach(function (n) {
      n.classList.remove('completed', 'playing', 'active', 'node-failed', 'node-success', 'revealed');
      var fill = n.querySelector('.tnode-ring-fill');
      if (fill) { fill.style.stroke = ''; fill.style.animation = 'none'; fill.style.strokeDashoffset = '256'; void fill.offsetWidth; fill.style.animation = ''; }
    });
    void nodesEl.offsetWidth; // flush the 'revealed' removal before re-adding so the wipe-in replays
    nodes.forEach(function (n) { n.classList.add('revealed'); });
    playIdx(0);
  }

  return { start: restart, stop: stopAdvance };
}

// Task order matches tab order in the HTML
var TASK_ORDER = ['bottle', 'blind', 'lamp'];

function switchToTask(key) {
  var tab = document.querySelector('.skill-tab[data-target="' + key + '-timeline"]');
  if (!tab) return;
  document.querySelectorAll('.skill-tab').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.skill-timeline').forEach(function (tl) { tl.classList.remove('active'); });
  tab.classList.add('active');
  document.getElementById(key + '-timeline').classList.add('active');
  Object.values(timelines).forEach(function (tl) { tl.stop(); });
  timelines[key].start();
}

function makeOnComplete(taskKey) {
  return function () {
    var idx  = TASK_ORDER.indexOf(taskKey);
    var next = TASK_ORDER[(idx + 1) % TASK_ORDER.length];
    switchToTask(next);
  };
}

var timelines = {
  lamp:   buildTimeline('lamp',   '#4a9e70', makeOnComplete('lamp')),
  bottle: buildTimeline('bottle', '#c07830', makeOnComplete('bottle')),
  blind:  buildTimeline('blind',  '#c04455', makeOnComplete('blind')),
};

// Kick off the initially-visible tab
// Start the skill timeline only when the skills section scrolls into view
(function () {
  var skillsSection = document.getElementById('skills');
  var started = false;
  if (!skillsSection) { timelines.bottle.start(); return; }
  var skillsIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && !started) {
        started = true;
        timelines.bottle.start();
        skillsIO.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  skillsIO.observe(skillsSection);
})();

// ── Skill tab switcher ────────────────────────────────────────────
document.querySelectorAll('.skill-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    var key = tab.dataset.target.replace('-timeline', '');
    switchToTask(key);
  });
});


// ── Task video focus lightbox ────────────────────────────────────
(function () {
  var EASE     = 'cubic-bezier(.25,.46,.45,.94)';
  var DURATION = '200ms';
  var PAD      = 48; // min margin from viewport edge

  var backdrop = document.createElement('div');
  backdrop.className = 'vfocus-backdrop';
  document.body.appendChild(backdrop);

  var fv = document.createElement('video');
  fv.className    = 'vfocus-video';
  fv.muted        = true;
  fv.loop         = true;
  fv.playsInline  = true;
  fv.autoplay     = true;
  fv.playbackRate = 1.8;
  document.body.appendChild(fv);

  var active = null;
  var leaveTimer = null;

  function place(rect) {
    fv.style.transition = 'none';
    fv.style.left   = rect.left   + 'px';
    fv.style.top    = rect.top    + 'px';
    fv.style.width  = rect.width  + 'px';
    fv.style.height = rect.height + 'px';
  }

  function expand() {
    var maxW = window.innerWidth  - PAD * 2;
    var maxH = window.innerHeight - PAD * 2;
    var w    = Math.min(maxW, (maxH * 16) / 10);
    var h    = (w * 10) / 16;
    var l    = (window.innerWidth  - w) / 2;
    var t    = (window.innerHeight - h) / 2;
    fv.style.transition = 'left ' + DURATION + ' ' + EASE +
                          ', top '    + DURATION + ' ' + EASE +
                          ', width '  + DURATION + ' ' + EASE +
                          ', height ' + DURATION + ' ' + EASE;
    fv.style.left   = l + 'px';
    fv.style.top    = t + 'px';
    fv.style.width  = w + 'px';
    fv.style.height = h + 'px';
  }

  document.querySelectorAll('.task-card').forEach(function (card) {
    var wrap      = card.querySelector('.task-video-wrap');
    var src       = card.querySelector('.task-video').src;
    var hoverTimer = null;

    wrap.addEventListener('mouseenter', function () {
      clearTimeout(leaveTimer);
      hoverTimer = setTimeout(function () {
        var rect = wrap.getBoundingClientRect();
        if (active !== card) {
          fv.src = src;
          fv.play();
          place(rect);
          active = card;
        }
        fv.style.display = 'block';
        fv.style.pointerEvents = 'none';
        backdrop.classList.add('active');
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            expand();
            setTimeout(function () { fv.style.pointerEvents = 'auto'; }, 200);
          });
        });
      }, 500);
    });

    wrap.addEventListener('mouseleave', function () {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    });
  });

  fv.addEventListener('mouseleave', function () {
    if (!active) return;
    fv.style.pointerEvents = 'none';
    var rect = active.querySelector('.task-video-wrap').getBoundingClientRect();
    fv.style.transition = 'left ' + DURATION + ' ' + EASE +
                          ', top '    + DURATION + ' ' + EASE +
                          ', width '  + DURATION + ' ' + EASE +
                          ', height ' + DURATION + ' ' + EASE;
    fv.style.left   = rect.left   + 'px';
    fv.style.top    = rect.top    + 'px';
    fv.style.width  = rect.width  + 'px';
    fv.style.height = rect.height + 'px';
    backdrop.classList.remove('active');
    active = null;

    leaveTimer = setTimeout(function () {
      fv.style.display = 'none';
      fv.pause();
    }, 200);
  });
})();

// ── BibTeX copy ───────────────────────────────────────────────────
var copyBtn = document.getElementById('copy-bib');
if (copyBtn) {
  copyBtn.addEventListener('click', function () {
    var text = document.getElementById('bibtex-text').textContent;
    navigator.clipboard.writeText(text).then(function () {
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
      setTimeout(function () {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
      }, 2200);
    });
  });
}

// ── Nav active state ──────────────────────────────────────────────
var sections = document.querySelectorAll('section[id], header[id]');
var navLinks = document.querySelectorAll('.nav-links a');
var navIo = new IntersectionObserver(function (entries) {
  entries.forEach(function (e) {
    if (e.isIntersecting) {
      navLinks.forEach(function (a) {
        a.style.color = a.getAttribute('href') === '#' + e.target.id
          ? 'var(--text)' : '';
      });
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });
sections.forEach(function (s) { navIo.observe(s); });
