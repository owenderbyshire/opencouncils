/** Where the reader's choice of dark mode is kept in this browser. */
export const THEME_KEY = "theme";

/**
 * Runs in <head> before the page paints: marks that JavaScript runs, and
 * applies the reader's saved choice of dark mode. Light is the default,
 * whatever the device prefers.
 */
export const THEME_SCRIPT = `(function(){var d=document.documentElement;d.dataset.js="";try{if(localStorage.getItem("${THEME_KEY}")==="dark"){d.dataset.theme="dark";var m=document.querySelector('meta[name="theme-color"]');if(m)m.content="#12181e"}}catch(e){}})();`;
