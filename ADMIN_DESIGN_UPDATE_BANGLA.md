# অ্যাডমিন প্যানেল ডিজাইন আপডেট

## আগে পড়ুন

এই ZIP-এ **পুনর্গঠিত reference source** আছে; এটি Vercel-এ যুক্ত GitHub `main`-এর সরাসরি বিকল্প বা deployment package নয়। সেখানে আলাদা Better Auth/Mongoose architecture ও অন্য ফিচার আছে। এই source সরাসরি সেই branch-এ overwrite/force-push, live database-এ সংযোগ বা deploy করবেন না। Backup, restore test, reviewed integration, migration ও staging-এর পর নিরাপদ Git push; **push-এর পরেই** deployment বিবেচনা করতে হবে। Live site, Vercel settings ও database-এ এই ডিজাইন আপডেট প্রয়োগ করা হয়নি। `READ_FIRST_DO_NOT_PUSH_TO_MAIN.md`, `GIT_PUSH_DEPLOY_NOW_BANGLA.md` এবং `docs/GITHUB_MAIN_COMPARISON.md` দেখুন।

## অ্যাডমিনে কী সহজ করা হয়েছে

- আগের কেন্দ্রীভূত অ্যাডমিনের navigation ও server-side permissions রেখেই নতুন সবুজ workspace, পরিষ্কার শিরোনাম, sidebar-এ section search, নিজের account এবং দোকান দেখার কার্যকর link। Mobile menu-তে keyboard focus, Escape ও scroll-lock ব্যবস্থা আছে।
- Dashboard-এ প্রকৃত সংরক্ষিত তথ্য থেকে হিসাব, role-অনুযায়ী quick access, stock, customer ও activity; সর্বশেষ order সময় অনুযায়ী সাজানো। Order value-তে unpaid order-ও থাকতে পারে—এটি নগদ আদায় হিসেবে দেখানো হয়নি। চার্টের তারিখ UTC।
- Orders-এ দৃশ্যমান search, status ও unpaid filter; filter বদলালে অন্য সক্রিয় filter বজায় থাকে। ফোনে customer, payment, channel ও মোটসহ card view। Customer তালিকাতেও মোবাইলে সংশ্লিষ্ট তথ্য ও search পাওয়া যায়।
- Products-এ বোধগম্য search/filter ও mobile action label। Inventory থেকে low-stock link এখন সত্যিই ১০ বা কম stock-এর পণ্য দেখায়। Stock পুরোনো হয়ে গেলে ভুল পরিবর্তন আটকে server থেকে বর্তমান মান refresh হয়।
- Website content-এর টেবিলে ছবির URL নয়, সংশ্লিষ্ট headline link; ফোনেও data, edit/duplicate/delete, visibility ও reorder control পাওয়া যায়। অনুমতি না থাকলে edit link দেখানো হয় না; server guard আগের মতোই কার্যকর।
- Settings-এ সব বিদ্যমান section-এর jump link এবং নিচের save bar-এ সাফল্য/ত্রুটি স্পষ্ট। Existing forms, server actions, records ও admin destinations বাদ দেওয়া হয়নি। Storefront আলাদাভাবে redesign করা হয়নি।

## যাচাই ও সীমা

- TypeScript ও **৬৬/৬৬ unit test** পাস; lint-এ **০ error, ১৪ warning**। Isolated production build-এর ফল `IMPLEMENTATION_REPORT.md`-এ দেখুন। `npm audit`: **৮টি moderate advisory**; জোর করে breaking update করা হয়নি।
- নতুন `npm run test:e2e:admin-ui`: disposable local file store-এ dashboard ও owner navigation, search, orders filter, settings save, mobile reorder, সীমিত role ও সরাসরি URL guard, sign out এবং keyboard drawer পরীক্ষা। Dashboard, orders, products, inventory, customers, hero slides ও settings—এই ৭টি screen-এ ৩২০, ৩৯০, ৭৬৮ ও ১৪৪০ px-এ পুরো পৃষ্ঠার horizontal overflow পরীক্ষা হয়েছে।
- `npm run test:e2e:inventory`: disposable store-এ product save, stale inventory rejection ও refresh, stock adjustment/ledger এবং variation-hold-এর ৫টি focused group পাস। এটি বাস্তব MongoDB transaction বা production-এর পরীক্ষা নয়।
- সম্পূর্ণ admin/storefront browser suite, screen reader audit, Atlas, বাস্তব email/Google/Blob/payment, multi-instance concurrency ও live migration পরীক্ষা করা হয়নি। আগের checkout/cancellation hold ও অন্যান্য বাকি কাজ অপরিবর্তিত।

দুটি browser suite **শুধু নতুন disposable local file store-এ** চালাতে হবে। এগুলো synthetic records তৈরি/পরিবর্তন করে। `E2E_DATA_DIR`, test-only `E2E_OWNER_PASSWORD`, `E2E_TEST_MODE=1`, `.niketon-e2e-disposable` marker এবং `/api/e2e/safety` handshake ব্যবহার করে; live MongoDB, Blob, বাস্তব গ্রাহক বা deployed URL-এ কখনও চালাবেন না। Test-এর synthetic data ZIP-এ নেই।

আসল `.env.local`, database, runtime `public/uploads`, private archive, `node_modules` ও build cache ZIP-এ রাখা হয়নি। `.env.example` কেবল template; credential chat বা Git-এ দেবেন না।
