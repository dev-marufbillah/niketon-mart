# Niketon Mart — বাস্তব প্রজেক্টের অবস্থা ও বাকি কাজ

**এই ZIP একটি আপডেট করা সোর্স-কোড হ্যান্ডওভার; লাইভ সাইটে ডিপ্লয় করা হয়নি। এটি এখনই বাস্তব অর্ডার নেওয়ার জন্য প্রস্তুত নয়।** Production checkout ও online cancellation ইচ্ছাকৃতভাবে বন্ধ রাখা আছে। নিচের “সম্পন্ন” মানে কোডে আছে; বাস্তব সার্ভিসে চালু ও নিরাপদ প্রমাণিত—এমন দাবি নয়।

এই source আগের ZIP থেকে পুনর্গঠিত। Vercel-এ সংযুক্ত `dev-marufbillah/niketon-mart`-এর `main` revision `892500c4d5a335dd34ecbc9ee5680f26f40dd944`-এর read-only তুলনায় অন্য architecture, auth, database schema ও remote-only feature পাওয়া গেছে; `docs/GITHUB_MAIN_COMPARISON.md` দেখুন। সরাসরি overwrite বা live DB-তে এই source চালাবেন না। **Git push, Vercel deploy বা settings পরিবর্তন করা হয়নি।** Chat-এ আগে দেওয়া Mongo credential production-এর আগে rotate করতে হবে।

## ১. এই আপডেটে সম্পন্ন

- **অর্ডারের নিরাপত্তার ভিত্তি:** পরীক্ষামূলক MongoDB checkout transaction এবং stock/ledger, coupon ও product admin-এর transaction/CAS কাজ স্থানীয় সোর্সে যোগ হয়েছে। Local MongoDB-তে সীমিত parallel/rollback পরীক্ষা পাস, কিন্তু Atlas ও পূর্ণ multi-instance বাস্তব action পরীক্ষিত নয়। Production checkout বন্ধই আছে।
- **Cancellation:** আপনার নির্বাচিত নিয়মে coupon-সহ অর্ডার ও অনিশ্চিত customer summary manual review চায়; বর্তমানে কোনো in-app staff review/reconciliation workflow নেই বলে সব environment-এ online cancellation held। Order/stock/coupon/customer বা refund স্বয়ংক্রিয়ভাবে বদলায় না। Paid/historical অর্ডারও বিশেষ review চায়।
- **Variation hold:** একাধিক variation group থাকলে product page ও quote-এ ক্রয় বন্ধ। Listing/search/wishlist-এ base/from/review দেখানোর পরিবর্তন ও unit test আছে; stale cart ও সব browser surface পরীক্ষা এখনও বাকি।
- **Google customer login:** Google-এর আসল sign-in বোতাম এবং server-side OAuth যোগ করা হয়েছে। আগে password account থাকলে লগইন করে Personal Information থেকে password নিশ্চিত করে Google connect করতে হবে; Google দিয়ে staff/admin access দেওয়া হয় না। আসল Google credentials ও callback না পাওয়া পর্যন্ত বাস্তব login পরীক্ষা বাকি। বিস্তারিত `docs/GOOGLE_LOGIN_BANGLA.md`।
- **নেভিগেশন ও homepage:** ইংরেজি ক্রম Home, Shop, Categories, Fresh Market, Grocery, অ্যাডমিন-নির্বাচিত category (যেমন Dates), About Us। Blog ফুটারে আছে। ডেস্কটপে Featured Categories বড় ও কেন্দ্রভিত্তিক একাধিক সারি; মোবাইলের আগের horizontal rail রাখা হয়েছে। নতুন পেজ খোলার সময় footer থেকে শুরু হওয়া রোধ এবং Back/Forward ও filter অবস্থানের জন্য পৃথক scroll পরীক্ষা আছে।
- **Dates ও সাবক্যাটাগরি:** Dates-এর দৃশ্যমান children ছবি-ভিত্তিক Explore tile-এর বদলে Category filter-এ আছে। নাম, ছবি, বর্ণনা, ক্রম, group ও দৃশ্যমানতা আগের **Categories & brands** admin-এ নিয়ন্ত্রিত। **Show subcategories as filters only** পছন্দটি top menu থেকে category সরানোর পরও রাখা যায়; সাধারণ অন্য category-র আগের cards অপরিবর্তিত থাকে।
- **পণ্য ও filters:** Shop সব প্রকাশিত category-র পণ্য দেখায়। Fresh Market ও Grocery অ্যাডমিনের parent group অনুসরণ করে; Dates তার family-র পণ্য ও সংশ্লিষ্ট category, brand, type, price ইত্যাদি filter-এ সীমিত। পণ্যে `Category / subcategory` থেকে যেমন `Dates › Ajwa` নির্বাচন করা যায়। Parent সরাসরি ও child পণ্য দেখায়; child কেবল নিজের প্রকাশিত পণ্য দেখায়। সংখ্যাটি প্রকাশিত পণ্যের সংখ্যা—স্টক নয়।
- **সঠিক ছবি:** নতুন পণ্যে অপ্রাসঙ্গিক ডিফল্ট ছবি বসে না; ছবি বেছে দিতে হয়। আপলোড চলাকালে Save আটকানো হয়। Product-এর main, gallery, variation ও category image-এর reference server-এ যাচাই করা হয়; `blob:`/`data:` এবং Vercel-এর অস্থায়ী local upload path আটকে দেওয়া হয়। লোকাল পরীক্ষা হয়েছে; বাস্তব Blob এখনও পরীক্ষিত নয়। ক্যাটাগরির ছবি না থাকলে প্রকাশিত পণ্যের ছবি বা নিরপেক্ষ placeholder দেখা যায়।
- **লোকাল উদাহরণ:** একেবারে নতুন local demo ডাটাবেজে editable Ajwa, Medjool, Mabroom, Safawi ও Sukkari নামের সাবক্যাটাগরি আছে। এগুলো শুধু উদাহরণ ক্যাটাগরি; **কোনো খেজুর-পণ্য, দাম, স্টক বা আসল পণ্যের ছবি বানানো হয়নি।** বিদ্যমান local/production ডাটাবেজে কিছুই স্বয়ংক্রিয়ভাবে যোগ বা পরিবর্তন হয় না।
- **ক্যাটাগরি নিয়ন্ত্রণ:** child hide করলে সেটি ও তার পণ্য প্রকাশ্যে দেখা যায় না; parent hide করলে তার children এবং সেসব পণ্যও লুকায়। শুধু “Show in category navigation” বন্ধ করলে টাইল লুকায়, কিন্তু প্রকাশিত পণ্য দোকান থেকে লুকায় না। পুরোনো category order ধরে রাখা ও local hide/show/order focused browser পরীক্ষায় যাচাই করা হয়েছে। Mongo-তে একটিমাত্র primary-navigation category রাখার unique index যোগ হয়েছে; পুরোনো একাধিক flag আগে review প্রয়োজন।
- **সৎ খালি অবস্থা:** নতুন production store-এ About লেখা না থাকলে অনুমান করে ইতিহাস না দেখিয়ে empty state দেখায়; অ্যাডমিনে প্রকাশিত লেখা থাকলে সেটিই দেখায়, আর ইচ্ছাকৃতভাবে unpublished পৃষ্ঠা লুকানো থাকে। কাজ না-করা ভাষা পরিবর্তন selector সরিয়ে English label রাখা হয়েছে এবং অনুপস্থিত ফোন/ইমেইলের খালি link দেখানো হয় না। এটি অনুবাদ ব্যবস্থা নয়।
- **নিরাপত্তা ও তথ্যের ভিত্তি:** বিদ্যমান কেন্দ্রীভূত অ্যাডমিন, permission-checked server action, পাবলিক product projection, BDT formatting এবং `AGENTS.md`-এর integration নিয়ম বজায় আছে। এই আপডেটে একটি anonymous category-write replay প্রত্যাখ্যান করা হয়েছে; এটি সম্পূর্ণ security audit নয়।

## ২. আছে, কিন্তু আংশিক / বাস্তবে যাচাই বাকি

| বিষয় | বর্তমান অবস্থা ও বাকি যাচাই |
|---|---|
| গ্রাহক ও স্টাফ লগইন | একটি sign-in entry থেকে server-verified active staff ও সাধারণ গ্রাহক আলাদা হয়; গুরুত্বপূর্ণ shopping flow-তে sign-in লাগে। আগের focused পরীক্ষায় বহু প্রবাহ পাস করেছে, তবে পুরো regression suite একবারে পুনরায় চালানো ও mixed-session/race পরিস্থিতি আরও যাচাই দরকার। |
| কার্ট ও wishlist | গ্রাহকভিত্তিক cart/wishlist ব্যবস্থা আছে; একাধিক ডিভাইসের সমান্তরাল wishlist edit, network failure ও পুরোনো unscoped data-এর নিরাপদ পুনরুদ্ধার আরও দরকার। |
| অ্যাডমিন ও owner | সংরক্ষিত owner পরিচয় `marufsalauddin76@gmail.com`; server-side role/permission ও status পরীক্ষা আছে। বাস্তব ইমেইল দিয়ে invitation/reset, session revocation, throttling এবং পূর্ণ RBAC নিরাপত্তা staging-এ পরীক্ষা করতে হবে। underscore-সহ অনুমোদিত admin return path পুনর্গঠিত কোডে অনুমোদিত; বাস্তব ইমেইল ও multi-instance staging পরীক্ষা এখনও বাকি। |
| ছবি | অনুমতি-পরীক্ষিত ও যাচাই করা upload কোড আছে। Vercel-এর জন্য Blob প্রয়োজন; বাস্তব Blob-এ upload, retrieval, deletion ও access পরীক্ষা করা হয়নি। Local disk কেবল local বা সত্যিকারের persistent self-hosted disk-এর জন্য। |
| দাম/প্রস্তুতি/ওজন | BDT format এবং পণ্য, preparation, weight ও order snapshot-এর ভিত্তি আছে। ঐতিহাসিক অসম্পূর্ণ/paid order-এর ক্ষেত্রে সুরক্ষামূলক hold আছে। বাস্তব অর্ডার, ওজন পরিবর্তন ও আর্থিক reconciliation end-to-end staging-এ যাচাই করতে হবে। |
| অর্ডার/ট্র্যাকিং | মালিকানা-সীমাবদ্ধ account access ও ব্যক্তিগত guest key আছে। পুরোনো plaintext/query-string guest link এবং অজানা customer provenance-এর জন্য নিরাপদ migration দরকার। কোনো অর্ডারের অবস্থান বাস্তব ডেটা ছাড়া অনুমান করা যাবে না। |
| ইমেইল/বিজ্ঞপ্তি | Admin invitation/reset এবং customer password-reset/verified-email পরিবর্তনের কোড আছে; mock ও আংশিক browser পরীক্ষা হয়েছে, বাস্তব inbox delivery ও পূর্ণ flow পরীক্ষিত নয়। Customer order email/SMS সম্পূর্ণ নয়। |
| কনটেন্ট/অপারেশন | ক্যাটাগরি, পণ্য, homepage, delivery area, payment method ও অন্যান্য সেটিংসের বিদ্যমান অ্যাডমিন অংশ আছে। বাস্তব ঠিকানা, যোগাযোগ, শর্ত, VAT, delivery charge এবং business claim মালিককে যাচাই করে পূরণ করতে হবে। |
| ডেটা ও পরিবেশ | Local JSON driver এক প্রক্রিয়ার demo/development-এর জন্য; বাস্তব MongoDB, একাধিক server instance এবং production load এখনও পরীক্ষা করা হয়নি। Live Vercel-এর বর্তমান কোড/ডেটা এই ZIP-এর মতো ধরে নেওয়া যাবে না। |

## ৩. লাইভ অর্ডারের আগে অবশ্যই করতে হবে

1. **Transactional checkout:** পরীক্ষামূলক MongoDB replica-set core স্থানীয়ভাবে order number/idempotency, stock/variant, coupon, customer/order ও ledger-এর commit/rollback এবং কিছু parallel/failure পরীক্ষায় পাস করেছে। প্রকৃত admin action-সহ অন্যান্য race, Atlas, একাধিক application instance, legacy data ও স্বাধীন review এখনও বাকি; এগুলো ছাড়া checkout-এর production hold সরাবেন না।
2. **Cancellation ও refund:** পরীক্ষামূলক cancellation core production action-এ যুক্ত নয়; server-side staff authorization, coupon/customer summary, historical order policy ও বাস্তব refund নিষ্পত্তি অসম্পূর্ণ। Payment/dispatch/admin race ও স্বাধীন review শেষ না হওয়া পর্যন্ত production cancellation বন্ধ থাকবে।
3. **Payment:** বাস্তব payment gateway এখনও তৈরি/যাচাই করা হয়নি; কেবল credential দিলে payment চালু হয় না। Gateway হলে provider verification, amount/BDT validation, replay protection, settlement ও refund reconciliation লাগবে। Manual verification-এ displayed আর্থিক snapshot-এর fingerprint binding এবং forged/stale/concurrent/anonymous local browser পরীক্ষা পাস করেছে। এটি payment হয়েছে তার প্রমাণ নয়; বাস্তব reconciliation/staging দরকার। Card number, CVV, PIN বা OTP সংরক্ষণ করবেন না।
4. **পুরোনো ডেটার নিরাপত্তা:** নির্দিষ্ট repository, deployment ও database শনাক্ত করে private backup এবং restore test করুন। Owner identity, duplicate email, `_meta`, category, order ও currency history পর্যালোচনা করুন। পুরোনো USD বা currency-অজানা টাকা অটোমেটিক BDT হিসেবে relabel/convert করা যাবে না; রূপান্তরে আলাদা অনুমোদন ও reconciliation লাগবে। Corporate archive-এর নিরাপদ সংরক্ষণ বজায় রাখুন; অনুমতি ছাড়া মুছবেন না বা ZIP-এ প্রকাশ করবেন না।
5. **বাস্তব সার্ভিস ও নিরাপত্তা:** MongoDB transaction/CAS ও একাধিক instance, Vercel Blob, verified-domain Resend invitation/reset, shared rate limiter/WAF, CSRF/security header, secret access, logging/monitoring ও backup recovery staging-এ পরীক্ষা করুন। Activity log বর্তমানে best-effort; একে অপরিবর্তনযোগ্য audit log ধরে নেবেন না।
6. **বাস্তব ব্যবসার তথ্য:** প্রকৃত খেজুরের ধরন ও পণ্য, নিজস্ব ছবি, BDT দাম, স্টক, tax, delivery area/rate, payment method, contact এবং আইনি লেখা অ্যাডমিনে দিন। Demo content/price ব্যবসার সত্য তথ্য হিসেবে ব্যবহার করবেন না।
7. **সম্পূর্ণ পরীক্ষা ও পর্যালোচনা:** পর্যাপ্ত মেমরির পরিবেশে পুরো browser suite একটানা চালান; forged checkout/quote/review, account switching, accessibility, mobile keyboard/anchors, performance, SEO এবং সমস্ত admin/API permission audit করুন। নির্ভরশীলতা advisory ও lint warning পর্যালোচনা করুন। Single featured-category Mongo index local Mongo-তে পরীক্ষা হয়েছে, কিন্তু বাস্তব Atlas/multi-instance staging এবং legacy data review এখনও বাকি।

## ৪. বর্তমান/Production ডাটাবেজে Dates বসানোর ধাপ

> আগে backup, data/currency review ও deployment অনুমোদন নিন। এই ZIP নিজে থেকে কোনো live data বদলায় না।

1. অ্যাডমিনে **Categories & brands** খুলুন। প্রয়োজন হলে আগের featured ক্যাটাগরির **Feature in primary navigation** টিক তুলে Save করুন।
2. `Dates` top-level ক্যাটাগরি তৈরি/এডিট করুন। উপযুক্ত গ্রুপ নির্বাচন করুন—সাধারণত **Grocery & Essentials**। **Show in category navigation** ও **Feature in primary navigation** টিক দিন, Save করুন।
3. প্রতিটি প্রযোজ্য নাম আলাদাভাবে লিখুন; **Parent category → Dates** নির্বাচন করে ছবি দিলে আপলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন, তারপর **Add** করুন। শুধু বাস্তবে ব্যবহারযোগ্য ধরনগুলো রাখুন।
4. **Products → New product**-এ পণ্যের সঠিক নাম, বিবরণ, ছবি, BDT দাম, স্টক ও ইউনিট দিন; **Category / subcategory** থেকে `Dates › সংশ্লিষ্ট নাম` নির্বাচন করে Save করুন।
5. Storefront-এ Dates, সেই child, ছবি, পণ্যের সংখ্যা ও ফলাফল দেখুন। কোনো পণ্য না দিলে খালি অবস্থা দেখা স্বাভাবিক।

## ৫. সেটআপের জন্য প্রয়োজনীয় গোপন কনফিগারেশন

`.env.example` উদাহরণ; প্রকৃত credential ZIP-এ নেই। Production-এ নিজস্ব HTTPS `NEXT_PUBLIC_SITE_URL`, `MONGODB_URI` ও প্রয়োজনে `MONGODB_DB`, persistent image-এর জন্য `BLOB_READ_WRITE_TOKEN`, বাস্তব admin mail-এর জন্য `RESEND_API_KEY` ও verified `ADMIN_EMAIL_FROM` লাগবে। প্রথম bootstrap-এর জন্য অনন্য ১২–২৫৬ অক্ষরের `SUPER_ADMIN_PASSWORD` নিরাপদ server environment-এ দিতে হবে; bootstrap-এর পরে সরানোর পদ্ধতি `DEPLOYMENT_GUIDE.md` দেখুন। Password কখনও সোর্স, client bundle বা এই তালিকায় লিখবেন না।

## ৬. পরীক্ষার সীমা

এই workspace-এ typecheck, **৬৬/৬৬ unit test**, lint (০ error, ১৪ warning) ও isolated build পাস। নতুন অ্যাডমিন ডিজাইনের ১১টি এবং inventory-এর ৫টি focused browser group কেবল disposable file store-এ পাস; বিস্তারিত `ADMIN_DESIGN_UPDATE_BANGLA.md`। আগের source-এ localhost MongoDB replica-set-এর **৩৫টি synthetic probe group** পাস; পরে যোগ করা Google-link race probe এখনও চালানো হয়নি। এগুলো Atlas, পূর্ণ browser/server-action race বা বাস্তব অর্ডারের প্রমাণ নয়। বিস্তারিত `IMPLEMENTATION_REPORT.md` দেখুন।

সর্বশেষ storefront changes-এ disposable file store-এ **Dates-এর ৯টি, category/product/facet scope-এর ৬টি এবং navigation/scroll-এর ৮টি focused browser group** পাস করেছে; অ্যাডমিন থেকে children ও পণ্য তৈরি/লুকানো/rename এবং filters-only setting যাচাই করা হয়েছে। বিস্তারিত `IMPLEMENTATION_REPORT.md`-এ। আগের inventory/product admin-এর **৫টি browser group**, mock email-সহ admin security ৬/৬ selected (২৪ skipped), category/media ৫/৫ selected (২৫ skipped), এবং synthetic Google/payment tests পাস করেছে। এগুলো বাস্তব email, Atlas, Blob বা payment নয়। একটি পরবর্তী পূর্ণ browser run timeout/ব্যর্থতা ও মেমরির চাপের পর বন্ধ করা হয়েছিল; কিছু focused test পরে পাস করলেও অন্য failures ও একটি সম্পূর্ণ suite এখনও যাচাই বাকি। আগের পূর্ণ রানে ১৬/৩০ পাস; কোনো একটানা পূর্ণ browser pass দাবি করা হচ্ছে না। Live data ও staging workflow পরীক্ষিত নয়।

আগের workspace-এর কিছু source হারিয়ে পুরোনো ZIP থেকে পুনর্গঠন করা হয়েছে; linked `main`-এর তুলনা করা হলেও remote-only কাজ integrate বা migrate করা হয়নি। একটি প্রথম দিকের ব্যর্থ unit run-এ এই কাজের workspace-এর project-local `.data/db.json`-এ synthetic customer fixture লেখা হয়েছিল। ফাইলটি মুছে ফেলা হয়নি এবং ZIP-এ নেই; এটি Atlas নয় এবং আপনার Windows কম্পিউটারের ডেটাও নয়।

আরও বিস্তারিত কারিগরি তালিকা: `REMAINING_TASKS.md`, `SECURITY_AUDIT.md`, `DEPLOYMENT_GUIDE.md`, `ADMIN_GUIDE.md` এবং `LOCAL_SETUP_BANGLA.md`।
