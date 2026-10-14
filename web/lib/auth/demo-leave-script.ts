export const demoLeaveScript = `(() => {
  const state = (window.__demoLeaveState = window.__demoLeaveState || { armed: false, timer: 0, bound: false });
  if (state.bound) return;
  state.bound = true;
  window.__demoLeave = 1;
  let durable = false;
  const sameSite = (url) => {
    try { return new URL(url, location.href).origin === location.origin; }
    catch { return false; }
  };
  const stay = (crossDocument) => {
    if (crossDocument) durable = true;
    if (durable && !crossDocument) return;
    state.armed = true;
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      state.armed = false;
      durable = false;
    }, crossDocument ? 60000 : 0);
  };
  const onNavigate = (event) => {
    if (event.info === "react-transition") return;
    const url = event.destination && event.destination.url;
    if (!url) return;
    if (!sameSite(url)) {
      state.armed = false;
      durable = false;
      window.clearTimeout(state.timer);
      return;
    }
    stay(event.destination.sameDocument === false);
  };
  const onClick = (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target && event.target.closest && event.target.closest("a[href]");
    if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
    if (!sameSite(anchor.href)) {
      state.armed = false;
      durable = false;
      window.clearTimeout(state.timer);
      return;
    }
    stay(true);
  };
  const onSubmit = (event) => {
    const form = event.target;
    if (!form || !form.action || !sameSite(form.action)) return;
    stay(true);
  };
  const onHide = () => {
    if (state.armed) return;
    fetch("/api/demo/leave", { method: "POST", keepalive: true, credentials: "same-origin" });
  };
  if (window.navigation) window.navigation.addEventListener("navigate", onNavigate);
  document.addEventListener("click", onClick, true);
  document.addEventListener("submit", onSubmit, true);
  window.addEventListener("pagehide", onHide);
})();`;
