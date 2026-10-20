# User needs programme — 2026-10

Owner brief of 2026-10-16: make the persona needs comprehensive, assess the
live app against them, propose improvements (including a rough-estimate
route into the provisional planner), gather market evidence, and spec the
competitor research. Implementation and Espresso QA specs follow **only after
the owner confirms** the findings below.

Built on `.sweetclaude/state/discovery.yaml` and `personas.yaml` (PR #430)
and verified against `src/` at `origin/main` `c6487be` (v8.36.0).

| File | What it is | Status |
|---|---|---|
| `01-USER-NEEDS.md` | Expanded personas: needs, steps, expectations, deal-breakers, success criteria, failure modes, knowledge levels | Draft — owner review |
| `02-ASSESSMENT.md` | The live app measured against `01`, with evidence | Draft — owner review |
| `03-SUGGESTIONS.md` | Options and recommendations, incl. estimate mode, discoverability, generalist vs bespoke | Draft — **owner decisions needed** |
| `04-MARKET-EVIDENCE.md` | SARS figures, penalty-count sources, willingness to pay, first-pass competitor teardown | Draft |
| `05-COMPETITOR-RESEARCH-SPEC.md` | Spec for the deep TaxTim teardown and the SA / international scans | Spec — ready to run |
| `06-IMPLEMENTATION-SPEC.md` | Batches B0–B6: features, improvements, prototypes | Spec v0.1 — approved scope (OD-1–OD-6) |
| `07-ESPRESSO-QA-SPEC.md` | Espresso automation measuring whether user expectations are met | **On hold (owner, 2026-10-16)** |
| `08-PAIA-REQUEST-DRAFT.md` | Request to SARS for provisional penalty statistics | Draft — owner to send |

**Open work is tracked in `BACKLOG.md` 100–109** (programme record
`docs/PROGRAMMES.md` P40): 100 = B0, 101 = B1, 102 = B2 + B6, 103 = B3,
104 = B4, 105 = B5, 106 = competitor research (`05`), 107 = PAIA request
(`08`, owner), 108 = Espresso spec (on hold), 109 = seasonal pricing.
This folder holds the reasoning; BACKLOG holds the status.

Nothing here changes `src/`. Every claim about the app cites `file:line`;
re-verify against `git log` before building from it.
