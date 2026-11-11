Melotrip update v6 = everything changed since v4 (so it also includes v5 and the feed refresh update).
1. Copy this folder over your project (replace files).
2. android/app/google-services.json is your Firebase file (package com.melotrip.app).
3. npm install ; $env:BUILD_TARGET="capacitor"; npm run build ; npx cap sync android ; build a new signed APK (uninstall the old app first).
4. git add . ; git commit -m "v6" ; git push origin main
SQL: run section 6 of supabase/migrations/20261109_feedback_round.sql if you have not yet.
