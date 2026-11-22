# হ্যান্ডওভার: সম্পন্ন, বাকি ও আপনার করণীয়

## গুরুত্বপূর্ণ

এই ZIP **সোর্স-কোড হ্যান্ডওভার**, live deployment নয়। **Production checkout বন্ধ** এবং online cancellation সব environment-এ ম্যানুয়াল-review hold-এ আছে। পরীক্ষামূলক Mongo checkout ও inventory/catalogue transaction আছে, কিন্তু পূর্ণ কাজ, staging পরীক্ষা ও স্বাধীন review ছাড়া আসল অর্ডার চালু করা যাবে না। Vercel-এ সংযুক্ত `dev-marufbillah/niketon-mart`-এর `main`-এর read-only তুলনায় বড় architecture/data পার্থক্য পাওয়া গেছে; `docs/GITHUB_MAIN_COMPARISON.md` দেখুন। **Git push, Vercel deploy বা settings পরিবর্তন করা হয়নি**।

## এই আপডেটে যা করা হয়েছে

- আগের অ্যাডমিনের সব navigation ও server-side permission রেখে dashboard, searchable sidebar, mobile menu, orders/customers/products/inventory, content table এবং settings আরও পরিষ্কার করা হয়েছে। Mobile reorder ও low-stock filter ঠিক করা হয়েছে। বিস্তারিত ও পরীক্ষার সীমা `ADMIN_DESIGN_UPDATE_BANGLA.md`।
- একই checkout retry key দিয়ে ভিন্ন order জমা পড়লে পুরোনো order-কে নতুনটির সফল ফল হিসেবে দেখানো বন্ধ; গ্রাহককে My Orders দেখে নতুন attempt শুরু করতে বলা হয়। ভুল বা অতি বড় BDT price, preparation, tax, delivery, coupon counter ও customer total হলে checkout fail closed করে।
- আপনার পছন্দ অনুযায়ী coupon-সহ cancellation এবং অনিশ্চিত customer aggregate আগে manual review-এর জন্য held; অর্ডার, stock, coupon, customer বা payment স্বয়ংক্রিয়ভাবে বদলায় না। বাস্তবে staff-র জন্য in-app review/cancellation/refund workflow এখনও তৈরি হয়নি।
- Vercel-linked `main`-এর সঙ্গে file/schema তুলনা এবং পরিচিত বেমানান Mongo database-এ index তৈরির আগেই read-only refusal যোগ করা হয়েছে। এটি পূর্ণ compatibility assurance নয়।
- Registered customer-এর email-এর জন্য MongoDB-তে case-insensitive partial unique index এবং Google subject-এর unique index; guest/staff shopper-কে শুধু email মিলিয়ে merge করা হয় না। একই সময়ে signup ও linking-এর local Mongo race পরীক্ষা হয়েছে। পুরোনো invalid/duplicate identity স্বয়ংক্রিয়ভাবে বদলায় না।
- Admin-এর primary-navigation category-এর জন্য MongoDB-তে একটিমাত্র নির্বাচন নিশ্চিত করার index; local file driver-এ একই প্রক্রিয়ায় একই guard। পুরোনো একাধিক flag থাকলে backup/review দরকার।
- Product-এর main, gallery ও variation image reference-এ server-side অনুমোদিত path/host যাচাই; temporary `blob:`/`data:` ও Vercel-এর local `/uploads` path save করা আটকানো। বাস্তব Blob upload/retrieval এখনও পরীক্ষিত নয়।
- Featured Categories বড় responsive desktop rows; mobile rail অপরিবর্তিত। Shop সম্পূর্ণ catalogue দেখায়; Fresh Market/Grocery ও Dates family-তে কেবল সংশ্লিষ্ট পণ্য ও filter। Dates-সহ নির্বাচিত category family-তে Explore tile-এর বদলে admin-managed filters, এবং নতুন navigation-এ footer flash প্রতিরোধ। Blog footer-এ ও About Us প্রধান navigation-এর শেষে। বিস্তারিত `docs/STOREFRONT_CATEGORIES_BANGLA.md`।
- Manual payment review-এর forged/stale/concurrent/anonymous replay, unresolved weight, non-BDT amount ও refund evidence-এর আলাদা local browser পরীক্ষা। এটি কোনো বাস্তব payment-এর প্রমাণ নয়।
- `npm run local:check` read-only local diagnostic যোগ হয়েছে; এটি কোনো credential দেখায় না বা Mongo-তে সংযোগ করে না। আগের Windows 500 সমস্যা আপনার কম্পিউটারে সমাধান হয়েছে কি না নিশ্চিত নয়: `LOCAL_SETUP_BANGLA.md` দেখুন।

## বাস্তবে বাকি কোড ও নিরাপত্তার কাজ

1. পরীক্ষামূলক Mongo checkout core স্থানীয় transaction/rollback/race পরীক্ষায় পাস করলেও, বাস্তব admin action ও variant edit-এর race, বহু application instance, Atlas, legacy data এবং স্বাধীন review বাকি। Cancellation core public action-এ সংযুক্ত নয়; staff authorization, coupon/customer summaries, refund ও historical-order policy অসম্পূর্ণ। সেগুলোর বাস্তবায়ন/সমন্বয় ও review শেষ না হওয়া পর্যন্ত production hold সরাবেন না। একাধিক variation group পণ্যের detail page/quote-এ কেনা বন্ধ; listing/search/wishlist-এ পর্যালোচনার মূল্য দেখানো হয়েছে, তবে stale cart ও পুরো browser পরীক্ষা বাকি।
2. বাস্তব payment gateway চাইলে authenticated provider session/callback, amount/BDT যাচাই, replay protection, settlement ও refund reconciliation তৈরি এবং পরীক্ষা। এখন gateway কার্যকর নয়। Customer password-reset email ও যাচাইকৃত email পরিবর্তন কোডে আছে; পূর্ণ browser ও বাস্তব provider পরীক্ষা হয়নি। Order email/SMS ও বাস্তব live tracking সম্পূর্ণ নয়।
3. Shared rate limiter/WAF, trusted proxy, CSRF/security headers, monitoring এবং পূর্ণ permission/accessibility/SEO audit। Customer password-change/session race, পুরোনো guest-order key ও wishlist/cart নিরাপদ migration আরও review প্রয়োজন। Activity log best-effort, immutable audit ledger নয়।
4. Dependency advisory এবং বাকি lint warnings review; dev-এ কখনও দেখা `destination stream` error পর্যবেক্ষণ। ছবি ও upload-এর policy আরও staging review দরকার।

## আপনার কাছ থেকে প্রয়োজনীয় সিদ্ধান্ত ও সেটআপ

1. আগে chat-এ প্রকাশ পাওয়া Mongo credential **rotate/revoke** করুন। আলাদা test database, সীমিত test-only user ও network access দিন; কখনও আসল database-এ destructive test চালাবেন না। এই ZIP-এর `test:mongo:local` শুধুমাত্র নিজে চালু করা localhost MongoDB পরীক্ষা করে, Atlas পরীক্ষা করে না। Atlas-এর জন্য আলাদা reviewed empty-target probe ও অনুমোদন প্রয়োজন।
2. নির্বাচিত Git branch `main`। Vercel-linked repo `dev-marufbillah/niketon-mart` সঠিক কি না নিশ্চিত করুন; পুনরায় fetch করে আগের তুলনার পর নতুন পরিবর্তন এসেছে কি না দেখুন। Remote-এর অন্য কাজ ও history সংরক্ষণ করে feature-by-feature review/integration-এর পর অনুমোদিত non-force push করতে হবে। GitHub access লাগলে নিরাপদভাবে দিন—token/password/private key chat-এ নয়। **Push-এর পরেই** Vercel settings/deployment বিবেচনা হবে।
3. আপনি নিজেই Vercel-এ server environment variables দেবেন: প্রয়োজনমতো `MONGODB_URI`, `MONGODB_DB`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, verified `ADMIN_EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`, protected owner bootstrap এবং Google OAuth settings। Secret chat বা Git-এ দেবেন না। `.env.local` ZIP/Git-এ নেই। Google Cloud consent screen ও exact HTTPS callback সেটআপের ধাপ `docs/GOOGLE_LOGIN_BANGLA.md`-এ। আসল Google login এখনো পরীক্ষা হয়নি।
4. Live database/repository সুনির্দিষ্ট করে private backup ও restore test, `_meta`, duplicate identities, featured flags, owner ও historical currency review করুন। এই source প্রথম Mongo সংযোগে index তৈরি করে, অর্থাৎ এটি DB mutation; আগে backup ও approval আবশ্যক। পুরোনো USD বা currency-অজানা অঙ্ক অনুমতি ছাড়া BDT-তে রূপান্তর বা relabel করবেন না। Corporate archive অনুমতি ছাড়া মুছবেন না।
5. Approved staging-এ বাস্তব Atlas, Google OAuth, Vercel Blob, Resend invitation/reset এবং multi-instance security/financial flow পরীক্ষা করুন। প্রকৃত পণ্য, খেজুরের ধরন, ছবি, দাম, স্টক, delivery, tax, যোগাযোগ ও legal content অ্যাডমিনে দিন। স্থানীয় demo তথ্য বাস্তব ব্যবসার তথ্য নয়।

## যাচাইয়ের সীমা

এই workspace-এ typecheck, **৬৬/৬৬ unit test**, lint (০ error, ১৪ warning) ও isolated build পাস। অ্যাডমিন UI-এর ১১টি এবং inventory-এর ৫টি focused browser group disposable file store-এ পাস; সাতটি screen চারটি desktop/tablet/mobile আকারে পরীক্ষা হয়েছে। আগের source-এ **৩৫টি localhost Mongo probe group** পাস; পরে যোগ করা Google-link race probe এখনও চালানো হয়নি। বিস্তারিত `IMPLEMENTATION_REPORT.md` দেখুন। আগের storefront source-এ disposable file store-এ Dates ৯, storefront scope ৬ ও navigation/scroll ৮ focused browser group পাস; এই নতুন checkout পরিবর্তনের পরে সেই browser suite পুনরায় চালানো হয়নি। এগুলো synthetic data; Atlas বা পূর্ণ distributed/action flow নয়। সর্বশেষ পূর্ণ browser run সম্পূর্ণ pass হয়নি। ZIP-এ `.env.local`, database, runtime uploads, credentials, archive, dependencies ও build cache নেই।

বিস্তারিত: `PROJECT_STATUS_BANGLA.md`, `REMAINING_TASKS.md`, `SECURITY_AUDIT.md`, `DEPLOYMENT_GUIDE.md`, `LOCAL_SETUP_BANGLA.md`।
