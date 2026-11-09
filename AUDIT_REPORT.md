# Melotrip – Overall check (Nov 7, 2026)

## Paano ko tiningnan
- ESLint sa buong `src` (0 errors), `npm audit` (0 vulnerabilities), production build, at lahat ng tests (22/22 pasado kapag may `.env`).
- Paghahanap ng mapanganib na pattern sa buong code: `dangerouslySetInnerHTML/eval`, hardcoded secrets/admin emails, `target=_blank`, `.single()`, pagbasa ng `window.location`, intervals/listeners na walang cleanup, at mga database write na hindi chine-check ang error.
- Binasa nang buo ang mga pangunahing daloy: login/auth, feed, post card, comments, chat, notifications, trips (gawa/detalye), agency dashboard/subscribe, at gamification.
- ⚠️ **Hindi ko binasa nang linya-por-linya ang lahat ng ~21,000 linya.** Hindi ko masisiguro na wala nang bug; nasa ibaba kung ano ang hindi malalim na nasuri.

## Naayos
| # | Problema | Ayos |
|---|---|---|
| 1 | Heart sa comment ay nawawala | Local state lang pala; ngayon naka-save sa `comment_likes` (kailangan ang SQL migration) |
| 2 | Walang @mention | Autocomplete ng pangalan, naka-highlight at tappable, may notification sa na-mention |
| 3 | Trip laging private | May switch na Public/Private sa paggawa, at puwede ring baguhin ng organizer sa Trip Details |
| 4 | Notification na walang bubuksan | Lahat ay may destination; bagong `/post/:id` page para sa like/comment/mention; may fallback ayon sa uri; bawal ang external link |
| 5 | URL param binabasa sa `window.location` (mali kapag may `?query`/`#`) | Ginamit ang `useParams` sa Chat, Mountain, Agency detail |
| 6 | Agency profile: hindi ma-save kapag binura ang laman ng field (bumabalik ang luma) | Nase-save na bilang blangko |
| 7 | XP naging `NaN` kapag walang template ng achievement | Naayos |
| 8 | Chat unread badge: dina-download lahat ng unread id bawat 10 seg (may 1000-row limit) at tuloy kahit nasa background | Server-side count; humihinto sa background |
| 9 | Dating bug sa video, chat, package share, startup, skeleton, push | Nasa nakaraang bersyon |

Pagwawasto: sinabi ko dati na "luma na" ang pumapalyang `commission.test.js`. Mali ako: wala lang `.env` sa sandbox ko. Kapag may `.env`, pasado ang 22/22.

## Kailangan mong gawin / bantayan (hindi ko ma-verify mula rito)
1. **Seguridad (pinakamahalaga).** Ang pag-check kung admin ka ay ginagawa sa app lang; ang tunay na proteksyon ay nasa database (RLS) na hindi ko nakikita. Kung maluwag ito, puwedeng gawing admin ng isang user ang sarili niya o gumawa ng "verified" na subscription gamit ang API.
   - I-run ang `supabase/audit_rls.sql` (read-only) at basahin ang resulta: mga table na walang RLS, at mga policy na bukas sa lahat.
   - I-run ang `supabase/migrations/20261108_security_guards.sql`: pinipigilan nito ang non-admin na magpalit ng `profiles.role/is_blocked`, `agencies.status/is_verified`, at ang `agency_subscriptions` status/plan. Ang mga normal na daloy ng app (free plan = verified, bayad = pending) ay pasado pa rin.
2. **Realtime ng chat:** i-on ang Replication sa `chat_messages` (Supabase → Database → Replication). May backup na polling, pero mas mabilis kapag naka-on.
3. **Public trip ng ibang user:** subukan gamit ang pangalawang account kung nakikita at nakakasali nila ang public trip mo. Nakadepende ito sa RLS ng `trips`.
4. **Lumang notifications** ay hindi na maaayos ang link (wala silang post id). Ang bago lang ang tama.
5. Run ang `20261108_comment_likes_mentions.sql` para gumana ang heart at mention. Kung hindi, may lalabas na mensahe at mase-save pa rin ang comment.

## Hindi pa naayos (mababa ang panganib)
- Gamification XP: read-then-write; puwedeng mawalan ng XP kapag sabay ang dalawang aksyon.
- Pull-to-refresh sa Feed: nagre-bind ulit ng listener sa bawat galaw ng daliri (medyo mabigat, hindi sira).
- `AuthContext`: kapag pumalya ang pagkuha ng profile (mahinang signal), papasukin siya bilang `role: user` kahit naka-block; nalilinis ito sa susunod na matagumpay na load.
- `ProtectedRoute.jsx` ay hindi ginagamit (patay na code). 18 lint warning ng mga hindi nagamit na variable (hindi nakakaapekto).

## Hindi ko nasuri nang malalim
Admin pages, Roadmap/RoadmapDetail, Mountain/Trail maps, Leaderboard, AgencyAnalytics/FinancialSummary, TripExpenses/Checklist/Gallery/Weather. Dumaan sila sa lint/build at pattern scan, pero hindi sa masusing pagbabasa. Sabihin mo kung alin ang una kong titingnan.

## Checklist para subukan sa phone
- [ ] Comment: i-heart → isara ang sheet → buksan ulit; nandoon pa ang heart at bilang.
- [ ] I-type ang `@` sa comment; lumalabas ang listahan; tap sa pangalan; i-send; natatanggap ng na-mention ang notification.
- [ ] Gumawa ng trip na Public at Private; tingnan sa pangalawang account.
- [ ] Tap sa bawat uri ng notification (like, comment, follow, trip, achievement); bumubukas ang tamang screen.
- [ ] Mag-send ng chat message: lumalabas agad nang hindi nag-back.
- [ ] Isarang-sarado ang app → padalhan ng message → notification → tap → bubukas sa chat.
