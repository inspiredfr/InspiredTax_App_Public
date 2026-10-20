/* Bundle entry. Evaluation order of the 19 modules follows all.js (00 → 15,
   mirroring the original concatenation order); the window bridge then
   republishes the inline-handler surface. */
import './all.js';
import './99-window-bridge.js';
