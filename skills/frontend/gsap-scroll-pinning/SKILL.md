---
name: gsap-scroll-pinning
description: Build pinned GSAP ScrollTrigger sequences — horizontal scroll journeys, zoom heroes, and scrubbed feature switchers — where a section locks in place while scroll drives its internal animation. Use when a page needs pin + scrub choreography, horizontal-scroll storytelling, a hero that zooms/dissolves on scroll, or scroll-driven state changes (tabs, steps) inside a pinned section.
---

# GSAP Scroll Pinning: Pin + Scrub Choreography

Three DOM-only patterns for sections that lock in place while scroll drives what happens inside them. No WebGL — for scroll-synced canvas/shader work, see `threejs-scrollytelling`.

## The Core Idea

`scrollTrigger: { pin: true, scrub: N }` converts a scroll range into a timeline's playhead: the section stays fixed on screen for as long as `end` says, and scroll position maps directly to animation progress. Everything below is variations on reading that progress correctly.

```javascript
gsap.to(el, {
  /* ...properties... */
  ease: 'none', // scrub supplies its own easing — see gsap-scroll-pinning's scrub note below
  scrollTrigger: {
    trigger: sectionRef.current,
    pin: true,
    scrub: 1, // seconds of lag smoothing; use `true` for exact 1:1
    start: 'top top',
    end: '+=800', // px, or a function returning px/percent
  },
})
```

`ease: 'none'` on a scrubbed tween is not a style choice — the scrollbar is already the easing curve. An eased scrub tween double-applies motion and feels like it's fighting the trackpad.

## Pattern 1: Horizontal Scroll Journey

Pin a wide `track` div, translate it left as the page scrolls vertically, so horizontal panels play like a second scroll axis:

```javascript
const panels = gsap.utils.toArray<HTMLElement>('.journey-panel')

const tween = gsap.to(trackRef.current, {
  x: () => -(trackRef.current!.scrollWidth - window.innerWidth),
  ease: 'none',
  scrollTrigger: {
    trigger: outerRef.current,
    pin: true,
    scrub: 1,
    start: 'top top',
    end: () => '+=' + (trackRef.current!.scrollWidth - window.innerWidth),
    snap: {
      snapTo: 1 / (panels.length - 1),
      duration: { min: 0.2, max: 0.4 },
      ease: 'power1.inOut',
    },
  },
})
```

`end` is computed from `scrollWidth`, not a fixed number — the pin duration must match how far the track actually needs to travel, so it stays correct when panel count or width changes. `snap` rounds the scrub to the nearest panel on release, so users don't get stranded mid-panel.

### containerAnimation: nesting triggers inside the horizontal track

Panel content still needs its own scroll-triggered reveals, but the panels move *horizontally*, not vertically — a normal ScrollTrigger measuring page scroll would never fire correctly on them. Pass the outer tween as `containerAnimation` so the nested trigger reads progress along the track instead of the page:

```javascript
gsap.from(content, {
  x: 60,
  opacity: 0,
  ease: 'power3.out',
  duration: 0.6,
  scrollTrigger: {
    containerAnimation: tween, // read horizontal progress, not page scroll
    trigger: panel,
    start: 'left 80%', // horizontal equivalent of "top 80%"
    once: true,
  },
})
```

Under `containerAnimation`, `start`/`end` keywords flip to their horizontal counterparts (`left`/`right` instead of `top`/`bottom`). Each panel gets independent triggers this way — reveals, drifting images, scale-ins — all keyed to the panel's own position in the track rather than to viewport scroll.

## Pattern 2: Zoom Hero

Pin the hero and scale a title up until it dissolves, cross-fading the background and chrome in the same timeline so every beat lands on one scrubbed playhead:

```javascript
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: containerRef.current,
    pin: true,
    scrub: 1.2,
    start: 'top top',
    end: '+=800',
  },
})

tl.to('.hero-title', { scale: 18, opacity: 0, ease: 'power2.in', duration: 1 })
  .to('.hero-bg', { opacity: 0.62, scale: 1.06, ease: 'power2.in', duration: 1 }, 0)
  .to('.hero-scroll-cue', { opacity: 0, duration: 0.15 }, 0)
  .to('.hero-bottom-line', { scaleX: 1, ease: 'power3.inOut', duration: 0.3 }, 0.68)
```

The position parameter (`0`, `0.68`) on each `.to()` is what makes this one choreographed beat instead of four independent scrubs — background and chrome fade out *alongside* the zoom, not after it, and the bottom line waits until the zoom is mostly done. A separate `repeat: -1, yoyo: true` loop for an idle scroll-cue hint runs outside the pinned timeline entirely — it's not scroll-driven, so it doesn't belong on the scrubbed `tl`.

## Pattern 3: Scrubbed State Switcher

A pinned section where scroll drives discrete state (active tab, active step) rather than continuous motion. Pin for a multiple of the viewport height, one "screen" per state, and use empty tweens with `onUpdate` to convert scrub progress into state-change calls:

```javascript
function activateFeature(index: number) {
  tabs.forEach((tab, i) => tab.classList.toggle('active', i === index))
  visuals.forEach((vis, i) =>
    gsap.to(vis, { opacity: i === index ? 1 : 0, scale: i === index ? 1 : 0.94, duration: 0.5, ease: 'power2.inOut' })
  )
}
activateFeature(0)

const tl = gsap.timeline({
  scrollTrigger: {
    trigger: sectionRef.current,
    start: 'top top',
    end: '+=200%', // 3 features → 3 viewport-heights of pin
    pin: true,
    scrub: 0.8,
    anticipatePin: 1,
  },
})

tl.to({}, { duration: 1, onUpdate() { this.progress() < 0.5 ? activateFeature(0) : activateFeature(1) } })
  .to({}, { duration: 1, onUpdate() { this.progress() < 0.5 ? activateFeature(1) : activateFeature(2) } })
```

`tl.to({}, {...})` tweens an empty object purely to get an `onUpdate` callback at a specific point in the timeline — there's nothing to animate, the tween exists only to gate `activateFeature` behind scrub progress instead of a scroll event listener. `anticipatePin: 1` removes the one-frame jump that otherwise happens when a pin engages right as a fast scroll reaches it.

## When to Use Which

- **Horizontal journey** — a sequence of distinct panels/steps where "swiping through" is the right mental model (case studies, process steps).
- **Zoom hero** — a single dramatic entrance beat, once, at the top of a page.
- **Scrubbed switcher** — a fixed small set of states (tabs, feature list) that should feel driven by scroll rather than clicked.

All three pin, so only run one per screenful — stacking pinned sections back-to-back without gap content reads as a stutter, not a sequence.

## See Also

- `gsap-scrolltrigger` — ScrollTrigger fundamentals (pinning, scrub, triggers)
- `gsap-timeline` — position parameter, nesting
- `threejs-scrollytelling` — same pin/scrub vocabulary applied to WebGL canvases instead of DOM
- Reference implementation: [landing-with-gsap](https://github.com/creativoma/landing-with-gsap)
