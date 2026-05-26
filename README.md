# graphictool

A browser-based graphic editor built entirely in **vanilla JavaScript** — no frameworks, no build tools, just a single HTML file and modular JS.

The project is a work in progress. The goal is a Figma-style canvas editor that runs in the browser without any dependencies.

**Live demo:** https://fabulous-alfajores-a23609.netlify.app

---

## State Management

The most deliberate architectural decision in this project is the custom state system in `state2.js`.

Instead of reaching for Redux or Zustand, I built a lightweight equivalent from scratch:

- A **single source of truth** — one `state` object that holds the entire application state (tool selection, viewport, document items, editor styles, drag context)
- A **`dispatch(action)`** function that handles all state mutations via a `switch` statement — the same pattern Redux uses internally
- A **pub/sub notification system** — `subscribe(fn)` registers listeners that fire on every state change, keeping UI and canvas in sync without a virtual DOM
- **Intentional mutation boundaries** — some fields (like `drag`, `history`, `ui.previewPos`) are documented as safe to mutate directly for performance-critical interactions like live dragging

```js
dispatch({ type: "UPDATE_ITEM", id: someId, patch: { x: 100, y: 200 } });
```

This architecture keeps the codebase predictable and easy to debug — every state change goes through one place.

---

## Features (current)

- Canvas rendering with pan and zoom
- Shape creation: circles, rectangles, stars, text
- Selection system with drag-to-move
- Rotation handle
- Layer reordering
- Grid overlay (toggleable)
- Figma-inspired light UI

## In Progress

- Scale handles (8-point transform system)
- Text editing engine (`textengine.js`)
- Undo/redo via history stack

---

## Stack

- Vanilla JavaScript (ES Modules)
- HTML5 Canvas
- No dependencies, no build step

---

## Running locally

```bash
# Just open index.html in a browser
# Or use a local dev server:
npx serve .
```

---

## Background

Built as a portfolio project during my time at [42 Wolfsburg](https://www.42wolfsburg.de/). The goal was to understand how tools like Figma manage state and canvas interactions at a fundamental level — by building the hard parts myself instead of abstracting them away.
