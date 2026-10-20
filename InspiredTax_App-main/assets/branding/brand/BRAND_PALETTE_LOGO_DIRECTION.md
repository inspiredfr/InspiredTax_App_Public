# InspiredTax — Brand Palette & Logo Direction

_Last updated: 17 Jul 2026 (imported with the brand package, #151). Covers
the logo artwork and brand palette. The app's UI tokens and fonts (Inter,
Space Grotesk, JetBrains Mono) are a separate system:
`docs/product/DESIGN-SYSTEM.md`._

## 1. Logo concept

**Mark:** a stylised **R** (South African Rand symbol) with a **+** and **=**
integrated into the letterform's negative space, rendered as a glossy 3D
glyph with diffuse/specular lighting.

**Why R, not a map:** earlier direction used an Africa-continent silhouette.
That was replaced because (a) an R is unambiguous South African currency
signage recognisable to the target market at a glance, which a continent
outline is not (South Africa ≠ "the continent" to SA users), and (b) it
resolves to a single ownable monogram rather than a generic
"map + floating icon" composition common across regional fintech apps.

**Two constructions of the mark exist, deliberately, for different jobs:**

| Construction | Used for | Why |
|---|---|---|
| **Glossy custom R+/=** (hand-authored artwork, diffuse + combined lighting filter) | Marketing master, lockups, Play Store listing icon, iOS app icon, Android launcher icon | Full detail is legible at launcher/marketing sizes on modern (xhdpi+) devices — verified by connected-component testing across real Android density buckets (96–192px), not just the old 48px baseline. |
| **Clean geometric R** (Poppins Bold letterform, no +/=) | Android notification icon, favicon, Android monochrome/themed-icon layer | Fine detail (the +/= glyphs) measurably does not survive below ~48px — verified via pixel-fragmentation analysis at 16/24/48px. These contexts use the letterform alone rather than risk illegible detail. |

This split is intentional, not a compromise: each asset is built for the
literal pixel budget it will actually render at.

## 2. Colour palette

### Dark mode (primary)
| Role | Hex | Notes |
|---|---|---|
| Background | `#010D30` | Brand navy. Locked value — do not use `#101126` or `#0F1126`, both of which appeared as drift in earlier working files and have been corrected back to this value. |
| Letterform (R) | `#1ADDE3` (cyan) | Glossy asset shows natural shading variance around this value (specular highlights lighten, shadow core darkens) — expected for a lit 3D render, not a palette deviation. |
| Accent (+/=) | `#0B52DA` (mid-blue) | Contrast vs cyan letterform: 3.86:1. Contrast vs navy bg: 2.87:1. |

### Light mode
| Role | Hex | Notes |
|---|---|---|
| Background | `#F8F9FC` | Brand off-white. |
| Letterform (R) | `#010D30` (navy) | **Not cyan.** Cyan-on-white measures 1.68:1 contrast — fails legibility outright. Light mode uses navy for the letterform instead, verified 19.06:1. |
| Accent (+/=) | `#0B52DA` (mid-blue, same as dark) | 6.49:1 against white — holds up on both modes without changing. |

All ratios are WCAG relative-luminance contrast, computed directly from
sampled pixel values, not estimated.

### Notification / monochrome
Single colour only — pure white (`#FFFFFF`) shape on a fully transparent
background. Android supplies its own tint at render time; do not bake in any
brand colour here, per platform spec.

## 3. Typography

**Wordmark ("InspiredTax"):** **DM Sans, SemiBold (600)**.
"Inspired" in the primary text colour (white on dark / navy on light), "Tax"
in the accent mid-blue (`#0B52DA`) on both modes.

**Tagline:** DM Sans Regular, small caps, letter-tracked, flanked by short
horizontal rules in the accent colour. Current copy: **"SOUTH AFRICAN TAX
MADE EASY."**

> Verification note: the wordmark font was reported as switched to DM Sans
> in the latest lockup exports. This document records that change per that
> report; it has not been independently re-verified letterform-by-letterform
> against a DM Sans reference here. Earlier working drafts in this project
> used Poppins Medium as a stand-in (the sandbox used to prototype lockups
> did not have DM Sans installed) — if any older asset still shows Poppins,
> it predates this switch and should be treated as superseded.

**Icon letterform (clean-construction tier only):** Poppins Bold. This is
unrelated to the wordmark — it's the typeface used to draw the geometric
"R" for the notification/favicon/monochrome tier described in §1, chosen
for its correct, professionally-designed letter proportions (verified via
topological check: exactly one enclosed counter-hole, positioned where an
R's bowl should be).

## 4. Asset tiers (what ships where)

1. **Marketing master** — full glossy R+/=, both modes, 1024px.
2. **Lockup** — icon + wordmark + tagline, both modes, horizontal orientation
   (stacked orientation pending — see Open Items).
3. **Platform icons** — iOS Light/Dark/Tinted; Android adaptive
   (foreground/background/monochrome) + legacy + Play Store 512.
4. **Micro tier** — notification icon (Android), favicon (web), both using
   the clean-construction R only.

Full technical mapping of every file to its destination lives in
`FINAL_PACKAGE/README.txt`, not duplicated here to avoid drift between two
sources of truth.

## 5. Open items

- Stacked-orientation lockup does not yet exist in the new filtered/DM Sans
  style. The previous stacked lockup (flat R, Poppins) was retired rather
  than shipped as a stale mismatch — regenerate from the same source used
  for the new horizontal lockups when available.
- DM Sans switch noted above is unverified by direct letterform inspection
  in this pass.
- Confirm whether Xcode's current icon-import flow needs a legacy multi-size
  asset catalog in addition to the three 1024px iOS masters supplied.
