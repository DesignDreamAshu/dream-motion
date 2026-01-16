(function () {
  function easingLinear(t) { return t; }
  function easingEase(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easingEaseIn(t) { return t * t; }
  function easingEaseOut(t) { return 1 - Math.pow(1 - t, 2); }
  function easingSpring(t) { return 1 - Math.cos(t * Math.PI * 4) * Math.exp(-t * 6); }
  function easingBounce(t) {
    var n1 = 7.5625;
    var d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
    if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
    t -= 2.625 / d1; return n1 * t * t + 0.984375;
  }
  function easingOvershoot(t) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  var easingMap = {
    'linear': easingLinear,
    'ease': easingEase,
    'ease-in': easingEaseIn,
    'ease-out': easingEaseOut,
    'spring': easingSpring,
    'bounce': easingBounce,
    'overshoot': easingOvershoot
  };

  function getFrameById(scene, id) {
    return scene.frames.find(function (frame) { return frame.id === id; }) || null;
  }

  function evaluateTransition(input) {
    var scene = input.scene;
    var motion = input.motion;
    var transitionId = input.transitionId;
    var timeMs = input.timeMs;
    var transition = motion.transitions.find(function (t) { return t.id === transitionId; });
    if (!transition) return [];
    var fromFrame = getFrameById(scene, transition.fromFrameId);
    var toFrame = getFrameById(scene, transition.toFrameId);
    if (!fromFrame || !toFrame) return [];

    var fromMap = new Map();
    fromFrame.nodes.forEach(function (node) { fromMap.set(node.id, node); });
    var toMap = new Map();
    toFrame.nodes.forEach(function (node) { toMap.set(node.id, node); });

    var nodeIds = new Set();
    fromMap.forEach(function (_, id) { return nodeIds.add(id); });
    toMap.forEach(function (_, id) { return nodeIds.add(id); });

    var tracksByNode = new Map();
    transition.tracks.forEach(function (track) {
      var list = tracksByNode.get(track.nodeId) || [];
      list.push(track);
      tracksByNode.set(track.nodeId, list);
    });

    var evaluated = [];
    nodeIds.forEach(function (id) {
      var base = toMap.get(id) || fromMap.get(id);
      if (!base) return;
      var node = JSON.parse(JSON.stringify(base));
      var tracks = tracksByNode.get(id) || [];
      tracks.forEach(function (track) {
        var local = timeMs - track.delay;
        var value;
        if (track.duration <= 0) value = track.to;
        else if (local <= 0) value = track.from;
        else if (local >= track.duration) value = track.to;
        else {
          var t = Math.min(1, Math.max(0, local / track.duration));
          var ease = easingMap[track.easing] || easingMap.ease;
          var eased = ease(t);
          value = track.from + (track.to - track.from) * eased;
        }
        node[track.property] = value;
      });
      evaluated.push(node);
    });

    evaluated.sort(function (a, b) { return a.zIndex - b.zIndex; });
    return evaluated;
  }

  function renderToCanvas(options) {
    var canvas = options.canvas;
    var nodes = options.nodes;
    var background = options.background;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    nodes.forEach(function (node) {
      if (!node.visible || node.opacity <= 0) return;
      ctx.save();
      ctx.globalAlpha = node.opacity;
      var centerX = node.x + node.width / 2;
      var centerY = node.y + node.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((node.rotation * Math.PI) / 180);
      ctx.scale(node.scaleX, node.scaleY);
      ctx.translate(-node.width / 2, -node.height / 2);

      if (node.type === 'rect') {
        if (node.cornerRadius && node.cornerRadius > 0) {
          var r = node.cornerRadius;
          var w = node.width;
          var h = node.height;
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.lineTo(w - r, 0);
          ctx.quadraticCurveTo(w, 0, w, r);
          ctx.lineTo(w, h - r);
          ctx.quadraticCurveTo(w, h, w - r, h);
          ctx.lineTo(r, h);
          ctx.quadraticCurveTo(0, h, 0, h - r);
          ctx.lineTo(0, r);
          ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.closePath();
          if (node.fill) { ctx.fillStyle = node.fill; ctx.fill(); }
          if (node.stroke && node.strokeWidth) { ctx.strokeStyle = node.stroke; ctx.lineWidth = node.strokeWidth; ctx.stroke(); }
        } else {
          if (node.fill) { ctx.fillStyle = node.fill; ctx.fillRect(0, 0, node.width, node.height); }
          if (node.stroke && node.strokeWidth) { ctx.strokeStyle = node.stroke; ctx.lineWidth = node.strokeWidth; ctx.strokeRect(0, 0, node.width, node.height); }
        }
      } else if (node.type === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(node.width / 2, node.height / 2, node.width / 2, node.height / 2, 0, 0, Math.PI * 2);
        if (node.fill) { ctx.fillStyle = node.fill; ctx.fill(); }
        if (node.stroke && node.strokeWidth) { ctx.strokeStyle = node.stroke; ctx.lineWidth = node.strokeWidth; ctx.stroke(); }
      } else if (node.type === 'line' && node.points) {
        if (node.points.length >= 4) {
          ctx.beginPath();
          ctx.moveTo(node.points[0], node.points[1]);
          for (var i = 2; i < node.points.length; i += 2) {
            ctx.lineTo(node.points[i], node.points[i + 1]);
          }
          if (node.stroke && node.strokeWidth) { ctx.strokeStyle = node.stroke; ctx.lineWidth = node.strokeWidth; ctx.stroke(); }
        }
      } else if (node.type === 'path' && node.pathData) {
        var path = new Path2D(node.pathData);
        if (node.fill) { ctx.fillStyle = node.fill; ctx.fill(path); }
        if (node.stroke && node.strokeWidth) { ctx.strokeStyle = node.stroke; ctx.lineWidth = node.strokeWidth; ctx.stroke(path); }
      } else if (node.type === 'text' && node.text) {
        var fontSize = node.fontSize || 16;
        var fontFamily = node.fontFamily || 'Arial';
        var fontWeight = node.fontWeight ? String(node.fontWeight) + ' ' : '';
        ctx.font = '' + fontWeight + fontSize + 'px ' + fontFamily;
        ctx.textBaseline = 'top';
        if (node.fill) { ctx.fillStyle = node.fill; ctx.fillText(node.text, 0, 0); }
        if (node.stroke && node.strokeWidth) { ctx.strokeStyle = node.stroke; ctx.lineWidth = node.strokeWidth; ctx.strokeText(node.text, 0, 0); }
      } else if (node.type === 'image' && node.src) {
        var img = new Image();
        img.onload = function () {
          ctx.drawImage(img, 0, 0, node.width, node.height);
        };
        img.src = node.src;
      }
      ctx.restore();
    });
  }

  function createPlayer(options) {
    var canvas = options.canvas;
    var scene = options.scene;
    var motion = options.motion;
    var transitionId = options.transitionId;
    var loop = options.loop;
    var playing = false;
    var start = 0;
    var rafId = 0;
    var transition = motion.transitions.find(function (t) { return t.id === transitionId; });
    var duration = transition ? transition.tracks.reduce(function (max, track) {
      return Math.max(max, track.delay + track.duration);
    }, 0) : 0;

    function tick(timestamp) {
      if (!playing) return;
      if (!start) start = timestamp;
      var elapsed = timestamp - start;
      var timeMs = duration > 0 ? Math.min(elapsed, duration) : elapsed;
      var nodes = evaluateTransition({ scene: scene, motion: motion, transitionId: transitionId, timeMs: timeMs });
      var background = getFrameById(scene, transition ? transition.fromFrameId : '')?.background || null;
      renderToCanvas({ canvas: canvas, nodes: nodes, background: background });
      if (elapsed >= duration) {
        if (loop) { start = timestamp; rafId = requestAnimationFrame(tick); return; }
        playing = false;
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    return {
      play: function () {
        if (playing) return;
        playing = true;
        start = 0;
        rafId = requestAnimationFrame(tick);
      },
      pause: function () {
        playing = false;
        if (rafId) cancelAnimationFrame(rafId);
      },
      seek: function (timeMs) {
        var nodes = evaluateTransition({ scene: scene, motion: motion, transitionId: transitionId, timeMs: timeMs });
        var background = getFrameById(scene, transition ? transition.fromFrameId : '')?.background || null;
        renderToCanvas({ canvas: canvas, nodes: nodes, background: background });
      }
    };
  }

  window.DreamMotionRuntime = {
    evaluateTransition: evaluateTransition,
    renderToCanvas: renderToCanvas,
    createPlayer: createPlayer
  };
})();
