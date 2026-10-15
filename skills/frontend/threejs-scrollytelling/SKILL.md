---
name: threejs-scrollytelling
description: Sync a single Three.js canvas to multiple DOM elements without scroll-jacking, then drive scroll-linked storytelling on top with GSAP + ScrollTrigger. Use when WebGL visuals must stay pixel-attached to scrolling DOM content (images, sections, cards), when building scrollytelling/narrative pages, or when GSAP needs to animate shader uniforms frame-accurately.
---

# Three.js Scrollytelling: DOM-Synced WebGL + GSAP

Two hard problems, one skill. First: keeping WebGL visuals attached to scrolling DOM elements without drift and without scroll-jacking. Second: choreographing narrative beats (reveals, pulses, wipes) on top of that with GSAP, without the animation layer and the render layer fighting each other.

## The Core Problem

You want WebGL visuals rendered "inside" DOM elements (e.g. every `<div class="image">` shows a shader-processed texture). The naive approaches fail:

- **One canvas per element** — WebGL contexts are limited per page, and resources can't be shared across contexts. Shader effects also can't extend past the element's box.
- **One fullscreen `position: fixed` canvas** — the standard fix: each frame, read every element's bounding box + `window.scrollY` and place meshes accordingly. But native scrolling doesn't run on the same thread as `requestAnimationFrame`. When a scroll lands *between* two rAF calls, the DOM moves and the canvas doesn't — visuals drift and lag behind the elements they're attached to. This desync is *why* award sites scroll-jack: hijacking scroll gives them control of the timing.

## The Solution: A Canvas That Scrolls With the Page

Don't fix the canvas to the viewport. Let it be `position: absolute` and re-pin it to the viewport yourself each frame:

```css
#canvas {
  pointer-events: none;
  position: absolute; /* NOT fixed */
  left: 0;
  z-index: -1;
}
```

```javascript
// each frame:
canvas.style.transform = `translate(${scrollX}px, ${scrollY}px)`;
```

The difference from `fixed` sounds like nothing but is everything: if a scroll happens between two rAF calls, an absolute canvas **physically scrolls with the page**, carrying its rendered pixels along with the DOM elements they're attached to. The stale frame is stale *in the right place*. No drift.

### The tradeoff: clipping, and how to mitigate it

A scrolling canvas gets clipped at its edges during fast scrolls (the page shows regions the canvas hasn't covered yet). Mitigations:

- **Vertical padding**: render extra pixels offscreen — 25% top and bottom works well. Costs fillrate.
- Or render to a fullscreen framebuffer and apply edge fading to mask the overflow.

Drift is visually disturbing; clipping isn't. Pick the fix that matches your performance budget.

```javascript
function onResize() {
  padding = 0.25; // 25% extra canvas above and below the viewport
  const canvasHeight = viewportHeight * (1 + padding * 2);
  resolution.set(viewportWidth, canvasHeight);
  renderer.setSize(viewportWidth * dpr, canvasHeight * dpr);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
}

// each frame — offset scroll by the padding so content lines up:
scrollOffset.set(window.scrollX, window.scrollY - viewportHeight * padding);
canvas.style.transform = `translate(${scrollOffset.x}px, ${scrollOffset.y}px)`;
```

## Mapping DOM Elements to Meshes

One plane mesh per DOM element, positioned in the **vertex shader** from pixel-space uniforms — no camera math, use a plain `THREE.Camera` (identity projection) and compute clip-space yourself:

```glsl
// img.vert — DOM pixel rect → clip space
uniform vec2 u_resolution;   // canvas size in px
uniform vec2 u_scrollOffset; // current scroll (padding-adjusted)
uniform vec2 u_domXY;        // element's page-space top-left (rect + scroll at measure time)
uniform vec2 u_domWH;        // element's width/height in px
varying vec2 v_uv;

void main() {
  vec2 pixelXY = u_domXY - u_scrollOffset + u_domWH * 0.5;
  pixelXY.y = u_resolution.y - pixelXY.y;      // flip: DOM y-down → GL y-up
  pixelXY += position.xy * u_domWH;            // scale unit plane to element size
  vec2 xy = pixelXY / u_resolution * 2. - 1.;  // px → NDC
  v_uv = uv;
  gl_Position = vec4(xy, 0., 1.0);
}
```

On the JS side, measure elements on resize (not per frame — layout reads are expensive) and store page-space coordinates:

```javascript
const rect = el.getBoundingClientRect();
item.x = rect.left + window.scrollX; // page-space, stable across scrolls
item.y = rect.top + window.scrollY;
item.mesh.material.uniforms.u_domWH.value.set(rect.width, rect.height);
// per frame, only the cheap uniform write:
item.mesh.material.uniforms.u_domXY.value.set(item.x, item.y);
```

Cull meshes manually against the (padded) canvas bounds — `frustumCulled` can't help because the vertex shader bypasses the camera:

```javascript
mesh.frustumCulled = false;
// per frame:
const canvasTop = scrollOffset.y;
const canvasBottom = canvasTop + resolution.y;
item.mesh.visible = item.y < canvasBottom && item.y + item.height > canvasTop;
```

## Wiring In GSAP

### One ticker, one render call

ScrollTrigger ticks on GSAP's internal rAF. If your render loop runs its own `requestAnimationFrame`, you have two independent loops that can land on different frames — the same one-frame drift the scrolling canvas just eliminated, reintroduced as "GSAP vs render". Drive the render from GSAP's ticker:

```javascript
// WRONG — a second, independent rAF loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// RIGHT — render on the same tick as every GSAP/ScrollTrigger update
gsap.ticker.add(animate);
```

### The proxy pattern: GSAP tweens data, the render loop reads it

There's no official GSAP/Three.js binding. The pattern: tween a plain object, read it each frame.

```javascript
const introProxy = { value: 0 };
gsap.fromTo(introProxy, { value: 1 }, { value: 0, duration: 1.4, ease: "power3.out" });

// in the render loop:
sharedUniforms.u_intro.value = introProxy.value;
```

Tweening a uniform object directly (`gsap.to(mesh.material.uniforms.u_progress, { value: 1, ... })`) is fine **only when nothing else writes that value**. The moment per-frame code and a GSAP tween both target one uniform, whichever runs last each frame silently wins. Route through a proxy and combine deliberately in the read.

### Separate channels for separate drivers

Don't add a GSAP effect into an already-driven uniform. If `u_strength` is written every frame from scroll velocity, a GSAP pulse mixed into it is masked exactly when it fires — scroll alone already saturates that uniform's visual range, and the ScrollTrigger fires mid-scroll. Give the GSAP effect its own uniform (`u_intro`) and let the fragment shader combine them:

```javascript
const sharedUniforms = {
  u_strength: { value: 0 }, // per-frame: scroll velocity
  u_intro:    { value: 0 }, // GSAP-driven: intro pulse, own channel
};
```

The same rule applies visually: a GSAP effect layered on an already-animated shader must look **distinct** from what the shader does on its own. A "stronger version of the existing glitch" as a reveal is invisible — scrolling triggers the lookalike effect that masks it. Use a different visual vocabulary (a curtain wipe next to a band glitch, a horizontal RGB split next to vertical tearing).

### scrub vs toggleActions

- **`scrub: true` + `ease: "none"`** — continuous values that should track the scrollbar 1:1 (reveal progress, wipe position). The scrollbar *is* the easing; a scrub tween with its own ease double-applies motion.
- **`toggleActions: "play none none reverse"`** — discrete one-shot animations with their own duration/easing (text reveals, headings). Under `scrub` these feel like they're dragging behind the trackpad instead of playing.

```javascript
// Continuous: per-element reveal, tracks scroll exactly
itemList.forEach((item) => {
  gsap.fromTo(item.mesh.material.uniforms.u_progress, { value: 0 }, {
    value: 1,
    ease: "none",
    scrollTrigger: {
      trigger: item.domContainer,   // each element is its own trigger
      start: "top bottom",
      end: "top center",
      scrub: true,
    },
  });
});

// Discrete: DOM-only beat, plays with its own easing, reverses on scroll-back
gsap.timeline({
  scrollTrigger: { trigger: "#section05", start: "top 80%", toggleActions: "play none none reverse" },
})
  .from("#section05__title", { autoAlpha: 0, y: 40, duration: 0.8, ease: "power3.out" })
  .from("#section05__description", { autoAlpha: 0, y: 20, duration: 0.6, ease: "power3.out" }, "-=0.4");
```

Per-item uniforms (not one shared `u_progress`) let multiple elements be mid-reveal simultaneously without fighting over one value. And DOM-only beats coexist with WebGL beats for free — both read the same scroll position; don't force DOM copy through the uniform pipeline.

### One-shot effects need a guaranteed-visible surface

A load-time beat (intro pulse) must land on something visible *at that moment*. If every image mesh is still covered by its reveal wipe or offscreen, the pulse runs invisibly. Give it a dedicated fullscreen quad drawn behind everything, and skip its render pass once settled:

```javascript
const introNoiseMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),  // fullscreen in NDC, no camera needed
  new THREE.ShaderMaterial({ uniforms: {...}, vertexShader, fragmentShader,
    depthTest: false, depthWrite: false }),
);
introNoiseMesh.renderOrder = -1;
introNoiseMesh.frustumCulled = false;

// per frame:
introNoiseMesh.visible = introProxy.value > 0.001;
```

### Reduced motion, always

Gate every animated beat through `gsap.matchMedia()`; reduced-motion users get end states instantly:

```javascript
const mm = gsap.matchMedia();
mm.add("(prefers-reduced-motion: reduce)", () => {
  introProxy.value = 0;
  itemList.forEach((i) => (i.mesh.material.uniforms.u_progress.value = 1));
});
mm.add("(prefers-reduced-motion: no-preference)", () => {
  setupIntroPulse();
  setupImageReveals();
  setupTextTimeline();
});
```

## Matching CSS Colors in Raw Shaders

To make WebGL effects blend seamlessly with the page (wipe covers, noise tinted with the background), read the color from CSS — but skip three.js's color-space conversion. `THREE.Color.setStyle()` converts sRGB→linear by default; a raw `ShaderMaterial` writes `gl_FragColor` without the inverse transform, so the converted color renders far darker than the CSS (maroon becomes near-black, and effects end with a visible snap).

```javascript
const css = getComputedStyle(document.documentElement).getPropertyValue("--color-background");
uniforms.u_bgColor.value.setStyle(css.trim(), THREE.LinearSRGBColorSpace); // store raw, match CSS pixel-for-pixel
renderer.setClearColor(css); // clear color CAN take the css string directly
```

## Effect Recipes

Fragment-shader building blocks that fit this architecture (all driven by the uniforms above):

**Scroll-velocity glitch** — derive a `strength` value from scroll speed with exponential decay, clamp into `u_strength`, and use it to scale UV distortion + brightness:

```javascript
// per frame:
const targetStrength = (Math.abs(scrollDelta) * 10) / viewportHeight;
strength *= Math.exp(-dt * 10);           // decay
strength += Math.min(targetStrength, 5);  // inject
sharedUniforms.u_strength.value = Math.min(1, strength);
```

**Curtain wipe reveal** (`u_progress` 0→1 via ScrollTrigger scrub) — bottom-to-top uncover with a torn per-band edge and a bright scanline at the boundary; overshoot the threshold (`* 1.1`) so the top edge fully clears:

```glsl
float revealStrength = 1. - smoothstep(0., 1., u_progress); // extra chaos while revealing
float th = u_progress * 1.1;
float y = v_uv.y + (rand - .5) * 0.3 * revealStrength;      // torn edge, settles flat
float reveal = 1. - smoothstep(th - 0.05, th, y);
color += edgeColor * (1. - smoothstep(0., 0.06, abs(y - th + 0.05))) * revealStrength; // scanline
color = mix(u_bgColor, color, reveal);
```

**RGB channel split** (`u_intro`) — horizontal chromatic aberration; deliberately perpendicular to the vertical band glitch so both stay readable when active together:

```glsl
if (u_intro > 0.001) {
  float ca = u_intro * 0.06;
  color.r = texture2D(u_texture, v_uv + vec2(ca, 0.)).r;
  color.b = texture2D(u_texture, v_uv - vec2(ca, 0.)).b;
}
```

**TV-static intro** — fullscreen noise tinted with `u_bgColor` plus bright bands sliding upward; opacity follows `u_intro` so the canvas loads "broken" and resolves to the flat background as GSAP eases the proxy to 0.

## Performance Tips

1. **Measure layout on resize, not per frame** — `getBoundingClientRect()` in the render loop causes layout thrashing; store page-space coords and add scroll in the shader.
2. **Manual visibility culling** — hide meshes outside the padded canvas bounds; `frustumCulled` is useless with a bypassed camera.
3. **Skip settled passes** — `mesh.visible = proxy.value > 0.001` beats rendering a no-op fullscreen quad every frame.
4. **Throttle stochastic uniforms** — update random/jitter values probabilistically (`if (Math.random() > Math.exp(-dt * rate))`) instead of every frame.
5. **Padding costs fillrate** — 25% top/bottom padding renders 50% more pixels; tune per device or switch to the framebuffer + edge-fade mitigation.
6. **`pointer-events: none` on the canvas** — the DOM stays fully interactive; the canvas is pure output.

## See Also

- `threejs-shaders` — GLSL basics, ShaderMaterial, uniforms
- `threejs-fundamentals` — renderer/scene setup
- `gsap-scrolltrigger` — ScrollTrigger fundamentals (pinning, scrub, triggers)
- `gsap-core` — tweening, `gsap.matchMedia()`
- Reference implementation: [WebGL-Scroll-Sync](https://github.com/creativoma/WebGL-Scroll-Sync) (originally by [Lusion](https://lusion.co))
