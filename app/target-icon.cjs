// Each recording owns its icon lookup. Late results must not overwrite a new target.
function createTargetIcon({ windowIcon, fileIcon, publish }) {
  let generation = 0;
  return {
    reset() { return ++generation; },
    current(token) { return token === generation; },
    token() { return generation; },
    async load(target, token) {
      let icon = null;
      try { icon = await windowIcon(target); } catch { /* Try the executable next. */ }
      if (token !== generation) return;
      if (!icon && target.image) {
        try { icon = await fileIcon(target.image); } catch { /* Keep the Cawal fallback. */ }
      }
      if (icon && token === generation) publish(icon);
    },
  };
}
module.exports = { createTargetIcon };
