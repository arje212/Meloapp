**Welcome to your Base44 project**

**About**

View and edit your app on [Base44.com](http://Base44.com).

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:**

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Create an `.env.local` file and set the right environment variables.

```env
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run the app: `npm run dev`

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)

Do not commit database, Supabase, EAS, or Expo credentials. Keep secrets in local environment files only.


Sundin ang steps:
bash# Sa iyong project folder (hindi android folder)
npm run build
npx cap sync
Tapos sa build.gradle (:app) — i-update ang version:
gradleversionCode 2
versionName "1.1"
Tapos:
Build → Generate Signed Bundle / APK → release

# 1. Sa project folder
npm run build
npx cap sync
npx cap open android
# 2. Sa Android Studio
#    - I-update ang versionCode at versionName
#    - File → Sync Project with Gradle Files
#    - Build → Generate Signed Bundle / APK → release

update sa vercel command: npm run build; vercel --prod