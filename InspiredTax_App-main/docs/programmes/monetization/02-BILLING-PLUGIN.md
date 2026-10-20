# 02-BILLING-PLUGIN — Custom Capacitor plugin for Google Play Billing 8

> **Status 2026-10-04.** Live contract for `PlayBillingPlugin.java`
> (methods `isAvailable`, `connect`, `getProducts`, `purchase`,
> `getPurchases`, `acknowledge`) and `14-entitlement.js`. Change both sides
> together (WR-4).

Minimal, dependency-free wrapper around
`com.android.billingclient:billing:8.0.0`. No RevenueCat, no cordova
layer (rationale: 00-DESIGN §9). One Java class + Capacitor
registration; JS side lives in `src/js/14-entitlement.js` (the plugin is
reached via `window.Capacitor.Plugins.PlayBilling`, same guarded idiom
as `_downloadBlob` — no ES import).

## 1. Files

| File | Change |
|---|---|
| `android/app/src/main/java/za/co/inspiredtax/app/PlayBillingPlugin.java` | new (~400 lines) |
| `android/app/src/main/java/za/co/inspiredtax/app/MainActivity.java` | `registerPlugin(PlayBillingPlugin.class);` in `onCreate` before `super` |
| `android/app/build.gradle` | `implementation "com.android.billingclient:billing:8.0.0"` |
| `android/app/proguard-rules.pro` | §6 keep rules |

## 2. Plugin API (JS surface)

All methods promise-based; every rejection carries
`{ code: <stable string>, message }`.

```ts
isAvailable(): Promise<{ available: boolean }>
  // BillingClient connectable + Play services present. false on
  // sideload/emulator-without-Play → app stays trial/basic, no errors.

connect(): Promise<void>
  // startConnection; idempotent; auto-reconnect on
  // onBillingServiceDisconnected with capped backoff (3 tries, then
  // reject SERVICE_DISCONNECTED — callers resync on next lifecycle event,
  // never poll).

getProducts(): Promise<{ products: Product[] }>
  // queryProductDetailsAsync(ProductType.SUBS, ["premium"]).
  // Flattens subscriptionOfferDetails → one entry PER base plan/offer:
  // { productId, basePlanId, offerToken, formattedPrice, priceAmountMicros,
  //   currencyCode, billingPeriod, recurrenceMode }
  // recurrenceMode: INFINITE_RECURRING (auto-renew) | NON_RECURRING (prepaid).
  // Launch plans appear here only while active in Play Console — the UI
  // renders this list verbatim (00-DESIGN §5). BACKLOG 73: every figure on
  // Go Premium (price, crossed-out price, saving, monthly equivalent,
  // "from …/month") comes from these live prices; on a phone nothing is
  // offered until they arrive, and a sync that ends without them calls the
  // productsUnavailable UI hook (retry button). The plugin ends its
  // BillingClient connection in handleOnDestroy.

purchase(opts: { productId, offerToken,
                 oldPurchaseToken?, replacementMode? }): Promise<void>
  // launchBillingFlow. Resolution comes via the purchasesUpdated event,
  // not this promise (promise resolves when the flow launches).
  // oldPurchaseToken + replacementMode only for plan changes (§5).

getPurchases(): Promise<{ purchases: Purchase[] }>
  // queryPurchasesAsync(SUBS) — the restore + resync primitive.
  // Purchase: { purchaseToken, productId, basePlanIds: string[],
  //   purchaseState: 'PURCHASED'|'PENDING', isAcknowledged,
  //   isAutoRenewing, purchaseTime }

acknowledge(opts: { purchaseToken }): Promise<void>
  // acknowledgePurchase. Call ONLY after verifier passes and state is
  // PURCHASED (never PENDING). Unacknowledged purchases are refunded by
  // Play after 3 days — acknowledge immediately on verification.

addListener('purchasesUpdated',
  (ev: { resultCode: string, purchases: Purchase[] }) => void)
  // Fired from PurchasesUpdatedListener: purchase completions, PENDING
  // transitions, and out-of-app changes delivered while running.
```

### Error codes (stable strings, mapped from BillingResult)

`OK, USER_CANCELED, SERVICE_UNAVAILABLE, BILLING_UNAVAILABLE,
ITEM_UNAVAILABLE, DEVELOPER_ERROR, ITEM_ALREADY_OWNED, NETWORK_ERROR,
SERVICE_DISCONNECTED, FEATURE_NOT_SUPPORTED, ERROR`

JS handling (normative, 00-DESIGN §8): `USER_CANCELED` → silent;
`ITEM_ALREADY_OWNED` → run `getPurchases()` restore silently;
`SERVICE_UNAVAILABLE`/`NETWORK_ERROR` → offline toast; others → generic
"Purchase failed" toast + `console.warn` (never `console.error` — smoke
gate treats those as failures).

## 3. Java implementation notes

- `@CapacitorPlugin(name = "PlayBilling")`; hold one `BillingClient`
  singleton, `enablePendingPurchases(PendingPurchasesParams...)` is
  mandatory in v8.
- All Billing callbacks arrive on background threads — resolve
  PluginCalls directly (Capacitor handles thread hop), but never touch
  views.
- `PurchasesUpdatedListener` → `notifyListeners("purchasesUpdated", data,
  true)` (retain until JS listener attaches — covers purchases completing
  during a cold start).
- No identifier: the plugin never calls `setObfuscatedAccountId()` or
  `setObfuscatedProfileId()` (DECISIONS DS-1, 2026-10-15; pinned on both
  sides by `tests/entitlement.js` 17m).
- Keep the class free of app logic: no entitlement decisions in Java.
  The plugin is a dumb pipe; the single source of truth stays in
  14-entitlement.js.

## 4. Verification flow (client-only v1)

On `purchasesUpdated` or `getPurchases()` result, for each purchase:
1. `purchaseState === 'PURCHASED'` else treat as PENDING (no unlock).
2. `productId === 'premium'`.
3. Not acknowledged → `acknowledge()`.
4. Write entitlement cache: state ACTIVE, `expiryTimeMs` — Billing 8
   client API does not expose expiry directly; derive: prepaid →
   `purchaseTime + period`; auto-renew → `purchaseTime + period` rolled
   forward to the first boundary > now (cache refresh on each resync
   keeps this honest; `isAutoRenewing=false` + past boundary → EXPIRED).
   The verifier interface hides this derivation so the future backend
   (subscriptionsv2.get returns exact `expiryTime` + real state incl.
   IN_GRACE/ON_HOLD/PAUSED/REVOKED) drops in cleanly. v1 approximates:
   missing-from-getPurchases + cache says ACTIVE → EXPIRED after the
   offline window; revoked purchases disappear from `getPurchases()` →
   same path (this is why REVOKED collapses to basic on next sync).

**As built after BACKLOG 70 (2026-10-14).** Billing 8's client `Purchase`
does not carry the base plan, so `purchasesToJs` always sends
`basePlanIds: []`. The JS verifier therefore:
- treats **Play listing the purchase** as the verdict: the cache records
  `verifiedAtEffective` (the sync moment on the tamper-guarded clock) and
  `_computeState` keeps Premium through `max(expiryTimeMs,
  verifiedAtEffective)` + the offline grace — a derived expiry that is too
  short, or a clock high-water mark ahead of the wall clock, cannot expire a
  purchase Play lists;
- learns the plan only from the purchase this install launched — a **plan
  hint** (`iss_device.planHints[purchaseToken]`, last five), recorded from
  the `purchasesUpdated` delta only; with the plan known, a subscription's
  period is rolled to the boundary past now whether or not it renews, a
  prepaid plan ends one period after purchase; unknown, it is a one-month
  guess the UI never shows as a date (`dateKnown`);
- writes `CANCELLED_PAID_THROUGH` for any purchase with
  `isAutoRenewing: false` (prepaid, or auto-renew switched off) — the UI
  reads "Access until";
- applies "missing → EXPIRED" only to a full `getPurchases()` list, never
  to a `purchasesUpdated` delta (an OK event with only a PENDING purchase
  shows the pending toast and changes nothing).

Known v1 limit (client-only, no trusted time): a user who syncs with the
phone clock set forward, sets it back and then stays offline keeps a lapsed
or refunded purchase for the size of that jump plus the offline grace — the
tamper-guarded clock holds at the forward mark. The pre-70 verifier had the
same exposure for renewing plans (it rolled expiry against the forwarded
wall clock); BACKLOG 70 extends it to prepaid and cancelled plans. Any
online launch ends it (full `getPurchases()` → EXPIRED). The v2 backend
verifier (exact `expiryTime` from Play) closes it.

## 5. Plan changes

- Upgrade (monthly → annual, launch-annual): `purchase({...,
  oldPurchaseToken, replacementMode: 'CHARGE_PRORATED_PRICE' })`.
- Current plan unknown (bought on another install — no plan hint): the app
  cannot tell an upgrade from a downgrade, so it opens Google Play's
  subscription page with a toast instead of launching a purchase that Play
  would refuse as already owned (BACKLOG 70).
- Downgrade (annual → monthly): `replacementMode: 'DEFERRED'` (switches
  at current period end; UI copy must say so).
- Prepaid top-up / prepaid → auto-renew: plain `purchase()` (Play
  handles prepaid stacking).
- Replacement modes map to `SubscriptionUpdateParams.ReplacementMode`
  constants in Java.

## 6. Proguard / R8 (stage M4)

```
# Capacitor bridge (reflection over plugin methods)
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * { @com.getcapacitor.PluginMethod public *; }
# Play Billing (library ships consumer rules; belt-and-braces)
-keep class com.android.billingclient.** { *; }
# WebView JS interface safety
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
```

`minifyEnabled true`, `shrinkResources true` in the release buildType
only.

## 7. Play Console runbook (owner)

1. **Products**: Monetize → Subscriptions → create product `premium`
   ("InspiredTax Premium"). Add the six base plans exactly as the table
   in 00-DESIGN §5 (ids are code-visible — must match verbatim). Prepaid
   plans: enable ZAR, set price; auto-renew plans: grace period 7 days
   (recommended), enable resubscribe.
2. **Launch offer retirement (manual, D-M1/D-M5)**: watch combined sales
   of `annual-launch-r300` + `prepaid-3m-launch-r150` (Play Console →
   Subscriptions dashboard). At ~100, **Deactivate** both base plans.
   Existing launch-annual subscribers keep renewing at R300 (Play
   behaviour for deactivated plans' existing subscribers) — intended.
3. **Testing**: internal testing track + License testing list (test
   payment methods; renewals run on accelerated test clock). QA
   checklist: purchase each plan; cancel → paid-through; test-card
   decline → grace; refund from Console → revoke; reinstall → restore;
   airplane mode → graceful failure; clock rollback → no extra trial
   days; second Google account. **Also run the trial-anchor on-device
   checklist** (`04-TRIAL-ANCHOR.md` §7): reinstall-while-signed-in does
   not reset the trial; declined sign-in / offline / no-Play ⇒ Basic, no
   trial (hard-gate).
4. **Data safety form**: purchases handled by Google Play; the trial
   anchor uses Google Sign-In with the least-privilege `drive.appdata`
   scope to store a single non-PII trial-start timestamp in the app's
   hidden Drive folder (D-M6) — no access to the user's real Drive files;
   no other network calls; no ads/analytics/tracking; financial data stays
   on-device AES-GCM encrypted. Declare Google Sign-In + the app-scoped
   Drive access accordingly.
5. Billing library major versions are supported ~2 years — diarise the
   bump.
