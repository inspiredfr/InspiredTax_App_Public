# Closed testing — recruiting and running the 14-day period

The launch's critical path (BACKLOG *Launch — Play Store*, C-H2). Rules from
Play Console Help, "App testing requirements for new personal developer
accounts" (answer 14151465, re-read 2026-10-14):

- at least **12 testers opted in continuously for the 14 days** before you
  apply for production access;
- a tester who opts out and back in starts their own 14 days again;
- Google can require more testing for "fewer than 12 opted-in testers" **or
  "insufficient tester engagement"**. The production-access form asks how
  testers engaged, what feedback came in and how it was collected, and what
  changed because of it (§5).

Console menu names move. If one below is not where it says, trust the
Console.

**How it runs (DECISIONS CT-1, 2026-10-14):** by hand, from the owner's
personal WhatsApp (+27 74 872 4304), Play Console and one private Google
Sheet. There is no bot. The Play Developer API cannot add people to a Console
e-mail list: its `edits.testers` resource takes Google Groups only. So adding
testers is a Console step whatever the tooling.

## 0. Go / no-go before the first install link (M3)

Added 2026-10-14 by the readiness assessment (`docs/PROGRAMMES.md` P10). M1
(asking for e-mails) and M2 can go out while G1–G3 run; **hold M3** until all
six read done. Testers who install a build that is about to change report
what is already fixed, and the 14 days are when Google judges engagement.

| # | Check | Why |
|---|---|---|
| G1 | **The closed track carries a build of current `main`** (BACKLOG 66). The last build was 8.35.2 (*Build InspiredTax* run 40, 2026-10-03); `main` has 66 commits since, including the large-text fix for the D13 failure (UI-FS-1), the new add forms, notes and tax cards, on-blur field messages, the crypto base-cost correction (para 20(1)(c)) and the bracket-threshold fix | The track build is what every tester installs |
| G2 | **Owner check on that build, installed from Play**: upload the same AAB to *Internal testing* as well as *Closed testing* — an internal release is available within minutes, while the closed one is in review (once: put both of your accounts on the internal track's tester list; its opt-in link is on its *Testers* tab). Run §6 (second account: opt in → install → sign in → trial → paywall → test card → Premium) and the first-five-minutes cases D1, D2, D4, D13, D16 and D11, plus D20 (export outcome, privacy link) and D24 (a)–(c) — the sign-in on `AuthorizationClient`, new in 8.36.0 (BACKLOG 75) (`DEVICE-CHECKS.md` §2). Record them in its §4 | Every tester hits sign-in, onboarding and, from day 8, the paywall. None of these has run on a phone (WR-3) |
| G3 | **The closed release shows as available** in the Console (review done) | M3 sends people to it |
| G4 | **Data safety form matches the privacy policy** (BACKLOG 33). The form answers *No* (DECISIONS DS-1). 8.36.0 sends no purchase identifier; merge site PR #23 (drops the policy's install-ID sentence) once 8.36.0 is on the track | Testers see it on the listing, and every update during the test — the day-7 one included — goes through review, where a form that disagrees with the privacy policy is grounds for rejection |
| G5 | **Feedback intake ready**: the tracker has the *Tester ID* column (§2c); `docs/programmes/closed-testing-2026-10/FEEDBACK-LOG.md` takes the de-identified entries | The production-access form asks what feedback came in, how, and what changed (§5) |
| G6 | **Feature tasks assigned** (`FEEDBACK-LOG.md` §1): every Premium feature has at least two testers | The form asks whether testers used all available features |

If G2 fails, do not send M3: the fix ships as the next patch (`RELEASE.md`)
and G1–G3 repeat.

**2026-10-15 (owner-reported):** 8.36.0 is on internal and closed testing
(G1). G2 ran on it: D1, D2, D4, D11, D13, §6 and D24 (a)–(c) pass; D16 (no
toast), D20 (every export read *Backup not saved*) and the step-7 Tax
balances chips failed (`DEVICE-CHECKS.md` §4). So G2 **failed**: the fixes
ship as 8.36.1, then G1 (8.36.1 on the track), the G2 re-run of D16 (with the
step-7 pills) and D20 on 8.36.1, and G3, before M3.

## 1. Setup and adding testers

**Setup — owner-reported 2026-10-14:**

- [x] Closed-testing track live; South Africa in its countries; e-mail list
  `inspiredtax-testers` attached
- [x] License testing: `inspiredtax-testers` selected, license response
  `RESPOND_NORMALLY` (§2a)
- [x] Feedback channel set on the track (shown on the opt-in page)
- [x] Android OAuth client carries the Play **app-signing** SHA-1 (QD-02)
- [x] OAuth Data Access lists only non-sensitive scopes (sign-in +
  `drive.appdata`). The consent screen is in production, so no OAuth
  test-user list is needed
- [ ] Second-account end-to-end check (§6): opt in → install → sign in →
  trial starts → paywall shows the test card

**Adding a tester:**

1. Play Console → the app → **Test and release → Testing → Closed testing**
   → the track → **Testers** → `inspiredtax-testers` → edit. Add the
   address and save. A tester needs a Google account and an Android phone.
   Ask for the address their **Play Store** uses (Play Store → profile
   picture, top right), not just "your Gmail": a phone with several
   accounts is the commonest failure.
2. License testing uses the same list, so it updates automatically.
3. Adding an address does not enrol anyone. The tester opens the install
   page `https://inspiredtax.co.za/get` (also the link the app's *Share
   InspiredTax* sends — its *No invite yet?* card routes newcomers to
   `/join`), which explains the steps and links
   to the opt-in page `https://play.google.com/apps/testing/za.co.inspiredtax.app`.
   There they tap *Become a tester*, then install from the Play page.
4. Google publishes no time for a list change to take effect. Wait 30–60
   minutes before sending the link (§2b M3).
5. The track is available only in the countries it lists (South Africa,
   per *Setup*). Someone whose Play Store country is elsewhere (an expat, a Play account set up abroad) sees *not
   available* however long they wait; add their country to the track or
   ask someone else.

## 2. Finding the testers

Send the invite to about **30 people within 48 hours**, and aim for **at
least 20 who confirm they signed in**, not 12. A dropout costs nothing unless
it takes the count below 12. Candidates: friends and family with Android
phones, colleagues, people who file their own SARS returns (freelancers,
landlords, investors — the people the app is for). Ask each for one real use,
not a glance.

The website's `/join` page opens WhatsApp to the owner's number with a
pre-filled request, for sharing in groups or Status. It is also how people
reached through family and friends sign up (§2d).

### 2a. License testing (done 2026-10-14): the trial is 7 days, the test is about 3 weeks

`ENT_TRIAL_DAYS = 7` (`src/js/14-entitlement.js`), so **every tester's trial
ends partway through the test** and the Premium features lock. Fix it in the
Console, not in the app: **Play Console → Settings → License testing**, with
the testers' list selected (done). A license tester sees Google's test cards
(always approves / always declines) and is never charged. Verified against
Play Console Help answers 6062777 and 9845334, read 2026-10-09.

Three things the list brings with it:

- It applies to **every track, including production**. To test a real paid
  purchase later, remove yourself from the list first.
- Allow a few hours after creating or changing a subscription product before
  testing — Google's cache has to expire.
- **A test subscription is short-lived.** Test renewals are accelerated: a
  monthly plan renews every ~5 minutes and an annual one every ~30 minutes,
  for at most six renewals before it ends (*Test Google Play Billing
  Library integration*, developer.android.com/google/play/billing/test,
  read 2026-10-14). So a tester's Premium lasts from about half an hour
  (monthly) to about three and a half hours (annual). On the next resync,
  Play no longer lists the purchase, `_ingestPurchases` marks it EXPIRED,
  and the paywall returns. They can subscribe again with the test card, as
  often as they like. The earlier text of this guide said a test
  subscription outlasts the 14 days; that was wrong. The invite (§2b) sets
  this expectation.

### 2b. Messages (adopted by the owner 2026-10-14)

Send from personal WhatsApp, **one chat per person**. Broadcast lists reach
only people who have saved your number, and individual chats get more
replies. Replace the `[brackets]`.

**M1 — Invite**

> Hi [name] – could you help me test my app? 🙏
>
> I built an Android app for SA tax (InspiredTax). It works out what you owe
> or are owed on your SARS return, and it runs entirely on your phone: your
> figures are encrypted and never leave it. Before Google lets it into the
> Play Store, at least 12 people have to test it for 14 days in a row.
>
> What I'd need from you:
> • 5 min to install it and sign in with Google
> • Keep it installed for about 3 weeks (I'll tell you when we're done)
> • Try one real (or made-up) thing – an IRP5, a rental, a home-office claim
> – and tell me anything confusing or broken
>
> It's free – you won't be charged anything. Android only.
> As a thank-you: 3 months of Premium free when it launches.
>
> If you're in, reply with the email your Play Store uses
> (Play Store → tap your profile picture, top right).

**M2 — Email received**

> Thanks! Got [email] ✅ I'll add you and send the install link later today.

If the address is not Gmail, add: *Just checking – is that the account your
Play Store is signed in with?*

**M3 — Install link** (30–60 min after adding them, §1)

> You're on the tester list ✅
>
> 1. On your Android phone, open: https://inspiredtax.co.za/get
> 2. If you have more than one Google account, make sure you're using [email].
> 3. Tap *Become a tester*, then *Download it on Google Play* → Install.
> 4. Open the app and sign in with Google.
>
> Let me know once you've signed in. If it says "not available", wait an
> hour and try again. If Play sits on *Installing…* for a few minutes,
> leave it – the first install can take a while, and it finishes on its own.
>
> Heads-up: after 7 days the app will ask you to subscribe. That's part of
> the test. You'll see a Google *test* card; choose it and you won't be
> charged anything. Test subscriptions only last a short while (under an
> hour for monthly, a few hours for yearly), so it may ask again later –
> just repeat it with the test card.

**M4 — Nudge** (24 h after M3 with no confirmation)

> Hi [name], did you manage to install InspiredTax? Any problem, just tell me
> and I'll sort it out.

**M5 — Check-in** (about day 7 after reaching 12)

> Quick InspiredTax update: thank you for testing! Please keep the app
> installed until I tell you we're done (about [X] more days).
>
> Your 7-day trial has ended, so the app will ask you to subscribe. Please
> try it with the Google test card (you won't be charged). It only lasts a
> short while, so it may ask again – that's the test system, not a bug.
>
> One small task: [e.g. add an IT3(b) / a rental / a home-office claim] and
> reply with one thing you'd change or that confused you.

**M6 — Testing done** (after production access is granted)

> Testing is complete – thank you! 🎉 You can keep the app or uninstall it.
> I'll send your 3-month Premium code when InspiredTax launches.

**M7 — Gift** (at launch, one unique code per person; §5)

> InspiredTax is live – thank you for testing! 🎉
>
> Your gift: 3 months of Premium free.
> Redeem: https://play.google.com/redeem?code=[CODE]
> (or Play Store → profile picture → Payments & subscriptions → Redeem code)
>
> Google may ask for a payment method. You won't be charged for 3 months,
> and Premium renews at the normal price after that unless you cancel. To
> avoid any charge, cancel any time before then in Play Store → Payments &
> subscriptions → Subscriptions.

**Do not say:** "you don't need to open it" (engagement is assessed), "Google
covers the payment" (false), or that the whole group's clock restarts if one
person leaves (it restarts only for that person, and only matters below 12).

### 2c. Tracker

One private Google Sheet, one row per person:

| Tester ID | Name | Phone | Referred by | Play email | Invited | Email received | Added to Play list | Link sent | Signed in (they confirmed) | Feature task | Feedback | Promo code | Code sent |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

*Tester ID* is `T01`, `T02`, … in order of first contact (invite sent, or
first message through `/join`). *Referred by* is the relay's name, or
blank for a direct invite. For someone who came through a relay, *Invited*
is the date of their first message. It is the only tester
reference that leaves the sheet: the repo's feedback log
(`docs/programmes/closed-testing-2026-10/FEEDBACK-LOG.md`) records feedback
by Tester ID with names, numbers and e-mail addresses removed, and the
*Feedback* column holds the log's `FB-` numbers.

The source of truth for the 12 × 14-day count is the **Play Console
dashboard**, not the sheet. The sheet holds names, numbers and e-mail
addresses: keep it private and delete it about 30 days after launch, once the
codes are sent (POPIA purpose limitation).

### 2d. Invites through other people (relays) — DECISIONS CT-4

Family members (and anyone else willing) can pass the invite on to their own
friends. Call them **relays**. The rule: **the relay forwards; the new tester
messages the owner directly.** A relay never collects e-mail addresses.

Why direct contact is required, not just tidier:

- **Right account.** Only the person who owns the phone can check which
  account their Play Store uses (§1 step 1). A relay copying "their Gmail"
  is the commonest way to add the wrong address.
- **The rest of the test runs in that chat.** M3 (link), M4 (nudge), the
  feature tasks, M5, feedback and the M7 code all go to the tester. A
  tester who has never messaged the owner can't be reached.
- **Consent (POPIA).** The tester gives their own address and number for
  this purpose, by messaging the owner. Nobody's details are passed on
  without them knowing.

**How it works**

1. The owner sends the relay **R0** (the brief), then **R1** as a *separate*
   message, so the relay can forward R1 on its own (long-press → Forward;
   WhatsApp forwards to at most five chats at a time).
2. The relay adds a line of their own above it ("My brother built this –
   could you help?"), so the recipient knows who it is from.
3. Interested recipients tap `https://inspiredtax.co.za/join`. It opens a
   WhatsApp chat with the owner and a pre-filled request ending "My Play
   Store email:" (live since 2026-10-14). People still type whatever they
   think of as their email, so check what they send.
4. The owner replies **M2r**, then continues exactly as for a direct invite:
   add to the list (§1), M3 once the gate allows (§0), and so on.
5. A relay who is on Android should be a tester too: send them M1 first.

**Fallback.** If a recipient won't message a stranger, the relay may send
the owner that person's **name and number, with their OK**. The owner then
sends them M1 directly. Never take an e-mail address second-hand.

**Pacing.** Ask each relay for 3–5 people, not a group blast. Every
arrival needs the routine (§3), the gate holds M3 until §0 is done, and a
pile of people waiting days for a link loses interest. Recipients abroad,
or whose Play Store is set to another country, can't install (§1 step 5).
R1 says *South African Play Store*.

**R0 — Brief to the relay** (owner → relay)

> Hi [name] – could you help me find testers for my app? 🙏
>
> I need people with Android phones to try InspiredTax (my SA tax app) for
> about 3 weeks, so Google will let it into the Play Store.
>
> Could you forward my next message to 3–5 friends who use Android –
> ideally people who do their own SARS returns? Add a line of your own so
> they know it's from you (long-press the message → Forward).
>
> You don't need to collect anything: they tap the link and message me
> directly, and I'll take it from there. Thank you!

**R1 — Forwardable invite** (owner → relay → friends)

> Hi! Could you help test a new South African tax app? 🙏
>
> I'm Allan, and I built InspiredTax, an Android app that works out what
> you owe or are owed on your SARS return. It runs entirely on your phone:
> your figures are encrypted and never leave it. Before Google lets it into
> the Play Store, at least 12 people have to test it for 14 days in a row.
>
> What it takes:
> • 5 min to install it and sign in with Google
> • Keep it installed for about 3 weeks (I'll tell you when we're done)
> • Try one real (or made-up) thing – an IRP5, a rental, a home-office claim
> – and tell me anything confusing or broken
>
> It's free – you won't be charged anything. Android phones with a South
> African Play Store only.
> As a thank-you: 3 months of Premium free when it launches.
>
> Interested? Tap here to message me on WhatsApp:
> https://inspiredtax.co.za/join
> and send me the email your Play Store uses (Play Store → tap your profile
> picture, top right).
>
> Thanks! – Allan

**M2r — Reply to someone who arrives through a relay**

> Hi [name], thanks for offering to test InspiredTax! 🙏
>
> [If they sent an address:] Got [email] ✅ – is that the account your Play
> Store is signed in with (Play Store → profile picture, top right)?
> [If not:] Could you send me the email your Play Store uses? (Play Store →
> tap your profile picture, top right.)
>
> I'll add you to the tester list and send the install link here – usually
> within a day or two. Who passed this on to you, so I can thank them?

M2r always asks for confirmation, because the sender may not have checked
Play Store before typing an address. It also says "a day or two", not
"later today", because the gate (§0) can hold M3.

**R2 — Thank the relay** (optional, once their people have joined)

> Thanks so much for passing it on – [n] of your friends have joined the
> test so far 🙌

## 3. Keeping the count up

**Routine while recruiting** (about 10 minutes, twice a day):

1. Copy new addresses from WhatsApp into the tracker; send M2 (or M2r to
   anyone who arrived through a relay, §2d).
2. Add them to `inspiredtax-testers` (§1); fill *Added to Play list*.
3. 30–60 min later send M3.
4. Record who confirms signing in; send M4 to anyone silent after 24 h.
5. Paste every piece of feedback into the tracker — §5 needs it.

**Milestones:**

| When | Action |
|---|---|
| Day 0–2 | M1 to about 30 people; run the routine |
| Dashboard shows ≥ 12 opted in | The 14 days start; record the date in STATUS |
| About day 7 of the 14 | M5; ship one small update that acts on feedback (`RELEASE.md`) |
| Dashboard shows the requirement met | Apply for production access (§5) |
| Access granted (review usually ≤ 7 days) | M6; publish to production |
| Launch | Promo codes, then M7 (§5) |

If the count drops below 12 on any day, recruit a replacement the same day.
The 14 days must be consecutive at or above the minimum.

**Engagement between milestones.** Google can ask for more testing for
"insufficient tester engagement", and the app sends nothing back to tell you
who is using it. Opened-once is the risk, not opted-out. Give each tester one
small feature task every three or four days, rotating through the matrix in
`docs/programmes/closed-testing-2026-10/FEEDBACK-LOG.md` §1, so the group
opens the app throughout the 14 days and every feature is covered. The
messages proposed for those tasks were declined by the owner on 2026-10-15
(DECISIONS CT-5): M1–M7 go out as adopted, with no scheduled task
messages; the matrix stays as a checklist of what testers' reports cover.

## 4. Daily check (about five minutes)

Play Console → **Quality → Android vitals** (crashes, ANRs) and the track's
feedback. A crash or ANR that blocks use is fixed as a patch release
(`RELEASE.md`). Record anything found in `BACKLOG.md`.

Android vitals sees only native crashes and ANRs. An error inside the app's
web layer — a button that does nothing, a screen that does not render — never
reaches it, and the app has no analytics by design. Those arrive only as
tester reports, so ask for a screenshot and the version line from **Menu →
About** with every problem. BACKLOG 67 (*Report a problem*, built for the
day-7 update — DECISIONS RP-1) puts both in one tap.

## 5. Production access and the thank-you gift

**Apply** from the Console dashboard once it shows the requirement met. The
form asks: how easy recruiting was; how testers engaged; the feedback
received and **how it was collected** (WhatsApp, logged in the tracker); the
target audience and value proposition; and **what changed because of the
test** (the day-7 update). Review usually takes seven days or less. The
pre-launch report (C-H3) appears after an upload to a track; fix blocking
crashes and security findings first.

**Switch the shared link (DECISIONS SHARE-1).** The app's *Share
InspiredTax* sends `https://inspiredtax.co.za/get`. On the day production
goes live, in the site repo set `var PLAY_LIVE = true;` in `get/index.html`
and push: people tapping the link then go straight to the Play listing
instead of the closed-test page, while WhatsApp's preview card stays. No app
update is needed, and copies of the app already installed follow the change.

**Gift — one-time promo codes (DECISIONS CT-2).** At production launch, not
before:

1. Play Console → **Monetize → Promotions** (promo codes) → a promotion of
   **one-time codes** on the Premium subscription with a **90-day free
   trial**. Quantity: testers who confirmed signing in, plus 5 spare. End
   date: at least 60 days after launch (codes stop working when the
   promotion ends).
2. **Redeem one spare code first** on a tester account that bought a test
   subscription during the test. Custom (shared) codes are limited to users
   who have never subscribed. It is not confirmed whether a license-test
   purchase counts against one-time codes too. If the redemption fails,
   stop: the fallback is an in-app grant, which is app work.
3. Send M7 to each tester who confirmed signing in. One code per person;
   record it in the tracker.

A promo-code trial renews at the paid price unless cancelled. M7 says so,
with how to cancel. Leaving that out turns a gift into a surprise charge.

## 6. Device checks during the period

The owner runs `docs/android/DEVICE-CHECKS.md` cases on the closed-testing
build (decision 2026-10-05). Cases needing the debuggable build (A2, A3) are a
separate session. Record results in §4 of that file.

**Reaching the paywall without waiting 7 days** (for the second-account check
in §1). There is no debug switch. The clock-tamper guard
(`_effectiveNow` / `entBumpClock`, `src/js/14-entitlement.js`; 00-DESIGN
§3.4) makes the steps below work. They were derived from the code and have
**not been run on a device** (WR-3):

1. With a second Google account: opt in, install from Play, sign in. The
   trial starts.
2. Settings → Date & time → automatic off; set the date **8 days ahead**.
3. Open and unlock the app. `entInit()` raises the clock high-water mark, so
   the trial reads as ended and Premium features lock.
4. Set the date back to automatic. The paywall stays: time is
   `max(wall clock, high-water)`, so rolling back never restores trial days.
5. Tap a locked feature → subscribe. Expect Google's test card; complete it
   and confirm Premium unlocks. Do this with the automatic date on, because
   sign-in and billing can fail on a wrong clock.
6. Optional: about an hour later (monthly plan), resume the app and confirm
   Premium has lapsed back to the paywall (§2a). That is the expected
   test-subscription behaviour, not a defect.

Only that device and account are affected, and that account's trial would
have ended after 7 real days anyway. Clearing app data resets the high-water
mark, but the Drive anchor's trial start still applies.
