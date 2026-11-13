/**
 * The beta notice above the top bar (src/components/beta-banner.tsx). A
 * reader who closes it is remembered in this browser under BETA_BANNER_KEY.
 * BETA_BANNER_SCRIPT runs in <head> before the first paint and marks <html>
 * with BETA_BANNER_ATTR, which hides the notice, so for that reader it never
 * shows or moves the page. Storage that is switched off only means the
 * notice comes back on the next visit.
 */
export const BETA_BANNER_KEY = "opencouncil_beta_banner_dismissed";
export const BETA_BANNER_ATTR = "data-beta-dismissed";
export const BETA_BANNER_SCRIPT = `try{if(localStorage.getItem("${BETA_BANNER_KEY}")==="1")document.documentElement.setAttribute("${BETA_BANNER_ATTR}","")}catch(e){}`;
