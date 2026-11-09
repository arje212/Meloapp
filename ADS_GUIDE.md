# Paano kumita sa mga video / app (Ads) – gabay

> Ito ay gabay lang. Wala pang ads na nakalagay sa app mo, kaya walang magbabago hangga't hindi mo ito ginagawa.
> Ang mga numero (bayad, threshold) ay galing sa opisyal na Google AdMob Help at maaaring magbago – tingnan ang Payments page mo.

## Ang katotohanan muna
- Ang kita sa ads ay **depende sa dami ng gumagamit at oras na ginugugol nila sa app**. Sa umpisa (maliit pa ang users) maliit pa rin ang kita.
- Mas malaki ang potensyal mo sa **direktang sponsor**: marami ka nang agencies sa Melotrip. Sila ang pinaka-malamang na magbayad para ma-promote.

## Pagkakasunod-sunod na irerekomenda ko

### 1) Direktang sponsor (walang Google, pinakamalaking kita bawat ad)
May `agency_banners` at "Share package" na sa app mo. Puwede mong gawing bayad:
- "Sponsored" post sa feed: ₱___ bawat araw/linggo, bayad via GCash.
- Banner sa Explore/Trips, at "Featured Agencies" na may buwanang bayad.
- Lagyan ng malinaw na label na **Sponsored** (kailangan para sa tiwala ng users at sa patakaran ng mga platform).
Hindi kailangan ng approval ng kahit sino; ikaw ang nagtatakda ng presyo.

### 2) Google AdMob (awtomatikong ads sa Android app)
Para sa Capacitor app mo, ito ang opisyal na dinadala ng Capacitor docs: ang community plugin `@capacitor-community/admob`
(v8 ang para sa Capacitor 8; Android API 24+).

**Mga uri ng ad na bagay sa video/feed app:**
| Ad | Saan ilalagay | Paalala |
|---|---|---|
| Banner | ilalim ng screen (Feed, Explore) | pinakamadali, pinakamababang kita |
| Interstitial (full screen) | **pagitan** ng mga video, hal. pagkatapos ng 4-5 reel o pagbalik mula sa isang trip | huwag habang nagpe-play ang video |
| Rewarded | "Manood ng ad para i-unlock ang ___" | pinakamataas ang bayad; opsyonal sa user |
| Native | kasing-itsura ng post sa feed | mas maganda tingnan, mas matagal i-setup |

> **Pre-roll sa mismong video (parang YouTube)**: karaniwang kailangan ng Google IMA SDK at VAST ad tag (hal. mula sa Google Ad Manager).
> Mas kumplikado at kailangan ng maraming views bago sulit. Gawin ito sa huli.

**Mga hakbang:**
1. Gumawa ng account sa https://admob.google.com (gamit ang tunay mong pangalan at address; kailangan mong makatanggap ng sulat).
2. **Apps → Add app** → Android → ilagay ang `com.melotrip.app`. Makukuha mo ang **App ID** (`ca-app-pub-xxxx~yyyy`).
3. Gumawa ng Ad units (Banner, Interstitial…) → makukuha mo ang **Ad unit IDs** (`ca-app-pub-xxxx/zzzz`).
4. `npm install @capacitor-community/admob` → `npx cap sync android`.
5. Android: sa `android/app/src/main/res/values/strings.xml` idagdag `<string name="admob_app_id">ca-app-pub-xxxx~yyyy</string>`
   at sa `AndroidManifest.xml` sa loob ng `<application>`:
   ```xml
   <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="@string/admob_app_id" />
   ```
6. Sa code (halimbawa, simulan pagkatapos mag-login at lumabas ang feed; **gumamit ng TEST ids habang nagde-develop**):
   ```js
   import { Capacitor } from '@capacitor/core';
   import { AdMob, AdmobConsentStatus, InterstitialAdPluginEvents } from '@capacitor-community/admob';

   // Test ids ng Google (huwag gamitin ang totoo habang nagte-test)
   const TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';

   export async function startAds() {
     if (!Capacitor.isNativePlatform()) return false;
     await AdMob.initialize();
     let info = await AdMob.requestConsentInfo();                 // consent (UMP)
     if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
       info = await AdMob.showConsentForm();
     }
     return info.canRequestAds;                                    // false = huwag magpakita ng ads
   }

   let shown = 0;
   export async function maybeShowInterstitial() {                 // tawagin sa PAGITAN ng mga video
     shown += 1;
     if (shown % 5 !== 0) return;
     await AdMob.prepareInterstitial({ adId: TEST_INTERSTITIAL });
     await AdMob.showInterstitial();
   }
   ```
7. Bago ilabas: palitan ng **totoong** ad unit IDs. **Huwag mag-click ng sarili mong ads** (puwedeng ma-ban ang account).

**Bayad (ayon sa Google AdMob Help):**
- Kailangan i-verify ang pagkakakilanlan mo.
- Pag umabot ang kita sa **$10**, magpapadala ang Google ng **PIN sa koreo** sa address mo (mga 3 linggo bago dumating); kailangan itong ilagay sa account.
- Babayaran ka kapag umabot ang balanse sa **$100 (USD)**, humigit-kumulang ika-21 ng susunod na buwan. Kung hindi pa umabot, nag-iipon ito.
- Ang paraan ng bayad (bank, atbp.) ay depende sa bansa; makikita sa **Payments** page.

### 3) Dapat mong tandaan (para hindi ma-ban)
- **Huwag gumamit ng AdSense code sa loob ng app** (WebView). Ang AdSense ay para sa **website**; ang AdMob ang para sa **app**. Pareho ang website mo (Vercel) at ang app, pero magkaiba ang paraan.
- Dapat may **sapat na tunay na content** ang app (meron ka naman: mga post, trips, chat). Ang app na pawang wrapper lang ng website ay mas madaling ma-flag.
- **Privacy Policy** na page (kailangan sa Play Store) na nagsasabing gumagamit ka ng ads at advertising ID. Sa Play Console, sagutan ang **Data safety** nang tama (Advertising ID).
- Huwag maglagay ng ads sa mga screen na maaaring makapaglinlang (hal. malapit sa "Pay" o "Confirm booking" na button).
- Huwag ipilit na manood ang user ng ad bago mag-chat o mag-book; masisira ang tiwala.
- Maglagay ng `app-ads.txt` sa website domain mo (Vercel `public/app-ads.txt`) at itugma ang website na nakalista sa Play Store listing; tinutulungan nito ang AdMob na i-verify ang app. Ang eksaktong laman ay nasa AdMob (Apps → app-ads.txt).

## Mungkahi
Simulan sa **#1 (sponsor)** habang lumalaki ang users, saka idagdag ang **#2** (interstitial sa pagitan ng mga video at isang banner).
Kung gusto mo, ako na ang maglalagay ng AdMob code sa app (naka-off hanggang ilagay mo ang ID mo) at ng "Sponsored" label sa feed.
