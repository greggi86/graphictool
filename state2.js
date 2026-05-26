export const state = {
  tool: "select",
  selectedShape: "circle",
  viewport: {
    zoom: 1,
    panX: 0,
    panY: 0
  },
  selectionId: null,
  ui: {
    gridVisible: false,
    gridPanelOpen: false,
    previewPos: null,      // direkt mutieren ok
    starOffsets: [],       // direkt mutieren ok
  },
  history: [],             // direkt mutieren ok
  drag: {                  // direkt mutieren ok
    active: false,
    mode: null,       // 'move' | 'scale' | 'rotate'
    handle: null,     // welches handle: 'tl','tm','tr','mr','br','bm','bl','ml'
    startX: null,
    startY: null,
    originX: null,
    originY: null,
    originW: null,
    originH: null,
    originRot: null,
  },
  document: {
    items: []
  },
  editor: {
    fill: '#2563eb',
    stroke: '#1d4ed8',
    textStyle: {
      fontSize: 24,
      fontFamily: 'Geist, sans-serif',
      fontWeight: 400,
      rotation: 0,
      align: 'left',
      lineHeight: 28,
      letterSpacing: 0
    },
    shapeStyle: {
      strokeWidth: 0,
      opacity: 1,
      rotation: 0
    }
  }
};

export function dispatch(action) {
  switch (action.type) {

    case "SET_TOOL":
      state.tool = action.tool;
      break;

    case "SET_SELECTED_SHAPE":
      state.selectedShape = action.shape;
      break;

    case "SET_SELECTION":
      state.selectionId = action.id;
      break;

    case "SET_UI":
      Object.assign(state.ui, action.patch);
      break;

    case "SET_VIEWPORT":
      Object.assign(state.viewport, action.patch);
      break;

    case "SET_GRID":
      Object.assign(state.ui, action.patch);
      break;

    case "SET_EDITOR":
      Object.assign(state.editor, action.patch);
      break;

    case "SET_EDITOR_TEXT":
      Object.assign(state.editor.textStyle, action.patch);
      break;

    case "ADD_ITEM":
      state.document.items.push(action.item);
      break;

    case "SET_ITEMS":
      state.document.items = action.items;
      break;

    case "DELETE_ITEM": {
      state.document.items.splice(action.index, 1);
      break;
    }

    case "REORDER_ITEMS": {
      const moved = state.document.items.splice(action.from, 1)[0];
      state.document.items.splice(action.to, 0, moved);
      break;
    }

    case "UPDATE_ITEM": {
      const it = state.document.items.find(i => i.id === action.id);
      if (it) Object.assign(it, action.patch);
      break;
    }

    case "UPDATE_ITEM_PARAMS": {
      const it = state.document.items.find(i => i.id === action.id);
      if (it) Object.assign(it.params, action.patch);
      break;
    }
  }

  notify();
}

export function setUI(patch)       { dispatch({ type: "SET_UI", patch }); }
export function setViewport(patch) { dispatch({ type: "SET_VIEWPORT", patch }); }
export function setState(patch)    { dispatch({ type: "SET_STATE", patch }); }

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}