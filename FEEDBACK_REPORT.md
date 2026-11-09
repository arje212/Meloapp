# Tester feedback (MELOTRIP-TEST.pdf): ano ang ginawa

✅ = naayos sa code  ·  🛠 = kailangan pa ng setup mo  ·  💬 = hindi ko binago, may tanong

| # | Puna ng tester | Resulta |
|---|---|---|
| 1 | Hindi nag-auto-refresh ang chat | ✅ Lumalabas agad ang message mo; nagre-refresh bawat 4 seg; realtime (nasa v3) |
| 2 | Nakikita ang email sa profile | ✅ Tinanggal sa public profile, follow lists, at leaderboard. ⚠️ Tingnan ang "Privacy" sa baba |
| 3 | `…` sa trail card (putol ang pangalan) | ✅ Buo na ang pangalan (naka-wrap) |
| 4 | Email ang kailangan sa group chat | ✅ Search by pangalan, i-tap para idagdag. Wala nang email |
| 5 | Agency: business email + description | ✅ May "Business Email" field at ipinapakita ito; may "About us" sa agency page |
| 6 | Walang search | ✅ Search button sa Feed → page na may People / Agencies / Mountains |
| 7 | Hindi ma-click ang profile mula sa follow list / chat | ✅ Clickable na ang follow list; tap sa photo/pangalan sa chat header → profile |
| 8 | Redundant ang Message button | ✅ Tinanggal ang maliit sa taas; nandoon pa rin ang malaking Message |
| 9 | GCash QR imbes na number | ✅🛠 Agency dashboard → GCash → i-upload ang QR. Kapag may QR, hindi na ipinapakita ang number. Kailangan ang SQL migration |
| 10 | Google Maps sa bundok | ✅ Button na "Tingnan sa Google Maps" sa package at sa Mountain page. Walang API key na kailangan. (Embedded na mapa = kailangan ng API key; sabihin kung gusto) |
| 11 | Email pagkatapos mag-book | ✅🛠 Nagawa ang function; kailangan ng Resend account (tingnan sa baba) |
| 12 | Reply: bagong linya imbes na thread, at kita ang @Cel | ✅ Threaded na (View N replies), may "Replying to", naka-highlight ang @name |
| 13 | Achievement notif: close lang | ✅ Bubukas ang detalye (icon, paliwanag, XP) |
| 14 | Walang settings / deactivate | ✅ Settings page (password, notifications, privacy, deactivate, request na burahin ang account) |
| 15 | Hindi kita ang HEIC | ✅ Kino-convert sa JPG bago i-upload (post, chat, profile, agency). Ang lumang HEIC na na-upload na ay may malinaw na mensahe |
| 16 | Hindi ma-message ang tropa sa online strip | ✅ Tap sa avatar → bubukas ang chat |
| 17 | Bagong register, auto-lumalabas sa online strip | ✅ Contacts mo lang (sinusundan mo / may chat ka) |
| 18 | New follower → pumupunta sa profile ng nag-follow | ✅ (bago); ang luma ay hinahanap sa pangalan |
| 19 | Story: hindi pumupunta sa profile | ✅ Tap sa pangalan/photo |
| 20 | Pag nagpost, may story rin | 💬 Disenyo ito ng app: ang "story" ay mga post sa nakaraang 24 oras. Gusto mo bang gawing hiwalay na opsyon? |
| 21 | Hindi napipindot ang "3 comments" | ✅ Bubukas ang comments |
| 22 | Walang notif sa bagong reply | ✅ May notification ang sinagot; ✅🛠 push kapag naka-setup ang Firebase |
| 23 | Story: bago ay nasa kaliwa, walang oras | ✅ Oldest→newest (bago sa kanan), may oras (hal. "2h") |
| 24 | Mic ay hindi gumagana | ✅ Walang RECORD_AUDIO permission noon; naidagdag, may malinaw na error. Kailangan ng bagong APK |
| 25 | Hindi naka-center ang reels | ✅ Naka-center at hindi lumalampas sa screen. (Hindi ko makita ang mismong phone; sabihin kung may mali pa) |
| 26 | Nawawala ang users pag offline | ✅ Gray na lang (naka-gray) at nasa strip pa rin |
| 27 | Back mula sa post → Chats | ✅ Ang bottom tabs ay "replace" na; Back mula sa tab → Feed, tapos lalabas ng app |
| 28 | Walang profile pic sa chat | ✅ Nasa chat list, strip, header, at messages |
| 29 | Crop sa profile pic | ✅ Crop/zoom na bilog bago i-save |
| 30 | Feed tab: refresh at tuktok | ✅ Kapag pinindot ang Feed habang nasa Feed: scroll sa taas + refresh |

## Dagdag na nakita ko habang inaayos
- "Active now" at green dot sa chat header ay laging naka-on kahit offline → totoong status na.
- "7-day streak" sa bawat profile ay peke (hardcoded) → tinanggal.
- Dobleng "Achievement Unlocked" (race condition) → naayos.
- "Invalid Date" sa package (mali ang pag-parse ng petsa, 8 lugar) → naayos.
- Ang file name na may espasyo/emoji ay puwedeng pumalya ang upload → nililinis na.
- Leaderboard ay nagpapakita ng email ng bawat user → tinanggal.
- Ang mic ay hindi pinapatay kapag isinara ang chat habang nagre-record → naayos.

## Kailangan mong gawin
1. **SQL** (Supabase → SQL Editor): `supabase/migrations/20261109_feedback_round.sql`
   (parent_id sa comments, agency email/QR, deactivation, deletion requests, booking email trigger).
2. **Email ng booking** (kung gusto mo):
   - Gumawa ng account sa https://resend.com, i-verify ang domain mo, kunin ang API key.
   - ⚠️ Kung hindi ka pa nakapag-verify ng domain, ang Resend ay makakapagpadala lang sa sarili mong email (test mode).
   - `supabase secrets set EMAIL_WEBHOOK_SECRET="<mahabang-random>" RESEND_API_KEY="re_..." EMAIL_FROM="Melotrip <bookings@iyong-domain.com>"`
   - `supabase functions deploy send-booking-email --no-verify-jwt`
   - SQL: `insert into private.email_config (id, function_url, webhook_secret) values (1, 'https://rpfqqupuperctyxuojwb.supabase.co/functions/v1/send-booking-email', '<parehong-secret>') on conflict (id) do update set function_url = excluded.function_url, webhook_secret = excluded.webhook_secret;`
3. `npm install` (bagong: heic2any, react-easy-crop) → build → `npx cap sync android` → bagong APK.

## Privacy: mahalagang paalala
Itinago ko ang email sa **screen**, pero ang email ay nasa `profiles` table pa rin na mababasa ng sinumang naka-login gamit ang API.
Ginagamit pa kasi ng buong app ang email bilang ID (chat, follow, notification). Ang tunay na solusyon ay malaking pagbabago:
gawing `user_id` ang ginagamit saanman at itago ang email column sa ibang user. Sabihin mo kung gusto mong simulan iyon.

## Hindi ko ginawa / limitasyon
- Ang mga post ng na-deactivate ay nakikita pa rin sa feed (nakatago lang sa search at mentions). Kailangan ng dagdag na filter sa feed query.
- Ang "Burahin ang account" ay request lang (nasa `account_deletion_requests`); ikaw/admin ang magbubura nang manu-mano. Hindi ko nabura nang awtomatiko ang data dahil nakakalat ito sa maraming table.
- Ang GCash QR ay para sa **agency booking**. Ang trip ng ordinaryong user (TripPayment) ay may sariling GCash number pa rin.
- Hindi ko nasubukan sa tunay na phone; ang mga test ko ay lint, build, 24 unit tests, at mga simulated na test ng mga Edge Function.
