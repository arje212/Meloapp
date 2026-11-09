# Push Notifications – Setup (isang beses lang)

Para lumabas ang notification sa phone kahit **sarado ang app** (parang Messenger/WhatsApp).
Dumadaan ito sa Firebase Cloud Messaging (libre). Hindi ko magagawa ang mga account step para sa iyo, kaya sundan ito.

## A. Firebase (5 minuto)
1. Pumunta sa https://console.firebase.google.com → **Add project** → pangalang `Melotrip`.
2. Sa project: **Add app → Android** → Package name: `com.melotrip.app` → Register.
3. I-download ang **`google-services.json`** → ilagay sa `android/app/google-services.json`.
   (Kailangan ito **bago** mag-build ng APK.)
4. **Project settings (⚙) → Service accounts → Generate new private key** → may madadownload na `.json`.
   ⚠️ **Sikreto ito.** Huwag i-commit sa GitHub, huwag i-send kahit kanino.

## B. Supabase
### 1) Database
Supabase → **SQL Editor** → i-paste at i-run ang laman ng
`supabase/migrations/20261107_push_notifications.sql`.

Tapos i-run din ito (palitan ang `MAHABANG-RANDOM-NA-SECRET` ng sarili mong mahabang random na text; **huwag i-commit**):
```sql
insert into private.push_config (id, function_url, webhook_secret)
values (1, 'https://rpfqqupuperctyxuojwb.supabase.co/functions/v1/send-push', 'MAHABANG-RANDOM-NA-SECRET')
on conflict (id) do update set function_url = excluded.function_url, webhook_secret = excluded.webhook_secret;
```

### 2) Edge Function
Gamit ang Supabase CLI (`npm i -g supabase`):
```powershell
supabase login
supabase link --project-ref rpfqqupuperctyxuojwb
supabase secrets set PUSH_WEBHOOK_SECRET="MAHABANG-RANDOM-NA-SECRET"
$json = Get-Content .\path\to\firebase-service-account.json -Raw
supabase secrets set "FIREBASE_SERVICE_ACCOUNT=$json"
supabase functions deploy send-push --no-verify-jwt
```
(Parehong secret ang gamitin sa SQL at sa `PUSH_WEBHOOK_SECRET`.)

## C. I-build ang app
```powershell
npm install
$env:BUILD_TARGET="capacitor"; npm run build
npx cap sync android
```
Android Studio → **Clean Project** → gawing `versionCode 16` → Generate Signed APK → i-uninstall ang luma → install.

## D. Subukan
1. Buksan ang app, mag-login → lalabas ang tanong na **"Allow Melotrip to send notifications?"** → **Allow**.
2. Supabase → Table Editor → `device_tokens`: dapat may row na para sa email mo.
3. Test mula sa PC (palitan ang SECRET at email):
```powershell
Invoke-RestMethod -Method Post -Uri "https://rpfqqupuperctyxuojwb.supabase.co/functions/v1/send-push" `
  -Headers @{ "x-webhook-secret" = "MAHABANG-RANDOM-NA-SECRET" } -ContentType "application/json" `
  -Body '{"table":"test","record":{"email":"EMAIL-MO@gmail.com","title":"Test","message":"Gumagana!"}}'
```
Dapat `sent: 1` at may lalabas na notification sa phone.
4. Totoong test: i-swipe away ang Melotrip sa recent apps, tapos padalhan ka ng message ng ibang account.
   Tap sa notification → bubukas diretso sa chat na iyon.

## Kung walang dumarating
- Android 13+: Settings → Apps → Melotrip → Notifications → dapat **Allowed**.
- **Mga phone na may agresibong battery saver** (Oppo/Realme/Xiaomi/Vivo/Samsung): Settings → Apps → Melotrip →
  i-on ang **Auto-start**, at Battery → **Don't optimize / Unrestricted**.
- Kapag **Force stop** ang app, walang push na darating hanggang buksan ulit (rule ito ng Android).
- Supabase → Edge Functions → `send-push` → **Logs** para makita ang error.
- `{"sent":0,"reason":"no registered devices"}` = hindi pa na-save ang token (hindi pa nag-Allow, o walang `google-services.json` sa build).

## Ano ang nagti-trigger ng notification
- Bagong **chat message** (1-on-1 at group; hindi ka nito ina-notify sa sarili mong message).
- Anumang bagong row sa **`notifications`** table (booking, payment, trip updates, achievements, atbp.).

## Hindi pa kasama
- **iPhone native app**: kailangan ng Mac + Xcode at **APNs key** na i-upload sa Firebase (Project settings → Cloud Messaging).
  Pareho na ang code, at hindi na kailangang baguhin ang function.
- **iPhone PWA (Add to Home Screen)**: kailangan ng ibang sistema (Web Push). Sabihin mo kung gusto mo.
