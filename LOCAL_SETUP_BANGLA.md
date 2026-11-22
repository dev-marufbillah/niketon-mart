# Niketon Mart: লোকাল সেটআপ

## ১. ZIP খুলুন

ZIP extract করে `grocery-website` ফোল্ডারটি VS Code-এ খুলুন। Node.js **20.9 বা নতুন** এবং npm ইনস্টল থাকতে হবে। ZIP-এ নিরাপত্তার জন্য `node_modules`, `.data`, আপলোড করা ব্যক্তিগত ফাইল, পুরোনো archive, build files বা আসল password রাখা নেই।

## ২. ইনস্টল ও চালু করুন

VS Code terminal-এ `npm ci` চালান। **শুধু `.env.local` না থাকলে** নিচের কমান্ড দিয়ে template কপি করুন; বিদ্যমান ফাইল overwrite করবেন না:

```bash
cp .env.example .env.local
```

Windows Command Prompt-এ `copy .env.example .env.local` ব্যবহার করুন। `.env.local` খুলে `SUPER_ADMIN_PASSWORD=`-এর পরে নিজের একটি **নতুন, গোপন, ১২–২৫৬ অক্ষরের** password দিন। কোনো পুরোনো demo password ব্যবহার করবেন না। `SUPER_ADMIN_EMAIL`-এর সুরক্ষিত owner ঠিকানা `marufsalauddin76@gmail.com`। Password কাউকে দেবেন না, Git-এ commit করবেন না।

```bash
npm run local:check
npm run dev
```

`local:check` শুধু সেটিংস পরীক্ষা করে; কোনো password/URI দেখায় না, network-এ যায় না এবং কোনো ফাইল বদলায় না। এটি MongoDB-তে সংযোগ সফল হয়েছে কি না পরীক্ষা করে না। Terminal বা system environment-এ থাকা variable, `.env.local`-এর খালি মানের ওপরও প্রাধান্য পেতে পারে।

দোকান: `http://localhost:3000`  
কাস্টমার ও স্টাফের একই সাইন-ইন: `http://localhost:3000/my-account/login`। পুরোনো `/admin/login` এই পেজেই যাবে। শুধু যাচাই করা সক্রিয় স্টাফের অ্যাডমিন ড্যাশবোর্ডের শর্টকাট দেখা যাবে; সাধারণ সাইন-আপে অ্যাডমিন অধিকার পাওয়া যায় না।

প্রথমবার owner তৈরি হওয়ার পরে `.env.local` থেকে bootstrap password সরিয়ে রাখতে পারেন; login password নিরাপদে সংরক্ষণ করুন। আগে তৈরি owner-এর password পরে `.env.local` বদলালে reset হয় না। লোকালে MongoDB না থাকলে `.data/db.json` তৈরি হয় এবং কিছু **demo** পণ্য/কনটেন্ট দেখায়—এগুলো আসল ব্যবসার তথ্য নয়। লাইভে ব্যবহারের আগে যাচাই/পরিবর্তন করুন।

### Windows-এ আগের HTTP 500 হলে

1. Dev server থাকলে `Ctrl+C` চাপুন। নিজের বর্তমান `.env.local` নিরাপদে backup রাখুন। `.data/db.json` বা Atlas-এর ডেটা মুছবেন না।
2. শুধু **local demo** চালাতে `.env.local`-এ `MONGODB_URI=` খালি করুন বা ওই লাইনটি `#` দিয়ে comment করুন। যদি PowerShell/Windows system environment-এও `MONGODB_URI` দেওয়া থাকে, সেখান থেকেও এই terminal-এর জন্য সরিয়ে নতুন terminal খুলুন। Production-এ MongoDB কখনও এভাবে সরাবেন না।
3. নতুন terminal-এ `npm run local:check` চালান। `local JSON file store` দেখানো উচিত; Mongo configured দেখালে কোনো inherited environment variable এখনও আছে। নতুন local owner তৈরি হলে শক্তিশালী `SUPER_ADMIN_PASSWORD` লাগবে। আগে থেকে owner থাকলে bootstrap password দিয়ে সেটি বদলাবে না।
4. `npm run dev` চালিয়ে `http://localhost:3000` খুলুন। লোকাল JSON ও Atlas **ভিন্ন ডেটা**—একটি অন্যটিতে কপি হয় না। এই নির্দেশ আপনার আগের Windows error সত্যিই সমাধান করেছে কি না এখানে নিশ্চিত করা যায়নি।

## ৩. ক্যাটাগরির ছবি ও নতুন পেজ

Admin → **Categories & brands**-এ ক্যাটাগরির পাশে **Edit** চাপুন, **Upload category image** থেকে ছবি দিন, আপলোড শেষ হলে **Save** চাপুন। ছবিটি ডেস্কটপ/মোবাইল মেনু ও হোমপেজে দেখাবে। ছবি না দিলে দৃশ্যমান পণ্যের ছবি, সেটিও না থাকলে নিরপেক্ষ placeholder দেখাবে। Vercel-এ স্থায়ী ছবির জন্য Blob কনফিগার করা আবশ্যক।

একই ফর্মের **Navigation group**-এ Fresh Market রাখলে ক্যাটাগরি ও তার সাব-ক্যাটাগরির পণ্য Fresh Market পেজে আসবে। Grocery & Essentials, Household বা Bakery রাখলে Grocery পেজে আসবে। Admin → **Site settings → Catalogue pages** থেকে তিন পেজের শিরোনাম ও বিবরণ বদলানো যায়।

খেজুরের জন্য **Dates** নামে top-level ক্যাটাগরি তৈরি/এডিট করে Grocery & Essentials গ্রুপ নির্বাচন করুন। **Show in category navigation** এবং **Feature in primary navigation** টিক দিয়ে Save করুন। একসঙ্গে একটি ক্যাটাগরি প্রধান নেভে দেখাবে; অন্যটি দিতে হলে আগেরটির Feature টিক তুলে Save করুন। **About Us** তার পরে সবার শেষে থাকবে; Blog ফুটারে আছে।

একই **Categories & brands** ফর্মে প্রতিটি খেজুরের নাম লিখে **Parent category → Dates** বেছে Add করুন। ছবি আপলোড, নাম পরিবর্তন, অবস্থান বদলানো এবং hide/show এখানেই করা যাবে। **Products → New product**-এ **Category / subcategory** থেকে যেমন `Dates › Ajwa` বেছে বাস্তব পণ্যের তথ্য, দাম, স্টক ও নিজস্ব সঠিক ছবি দিন। সাবক্যাটাগরি ও পণ্য থাকলে Dates বা নির্দিষ্ট সাবক্যাটাগরি খুললে সেই ডাটাই দেখাবে; ক্যাটাগরির সংখ্যা প্রকাশিত পণ্যের সংখ্যা, স্টকের সংখ্যা নয়।

একেবারে নতুন লোকাল ডেমো ডাটাবেজে Ajwa, Medjool, Mabroom, Safawi ও Sukkari নমুনা সাবক্যাটাগরি আছে; **কোনো খেজুর-পণ্য, দাম বা স্টক বানানো হয়নি**। পুরোনো লোকাল বা production ডাটাবেজে এগুলো স্বয়ংক্রিয়ভাবে যোগ হবে না—অনুমোদিত deployment ও backup/review-এর পরে অ্যাডমিন থেকে যুক্ত করুন। বিস্তারিত বাস্তব-প্রজেক্ট তালিকা `PROJECT_STATUS_BANGLA.md`-এ।

## ৪. গুরুত্বপূর্ণ সীমাবদ্ধতা

- Production checkout এবং অনলাইন cancellation নিরাপদ transaction তৈরি ও পরীক্ষা না হওয়া পর্যন্ত বন্ধ। লোকাল test-এ অর্ডার করা যায়, কিন্তু সেটা লাইভ নিরাপত্তার প্রমাণ নয়।
- Online payment gateway এখনো তৈরি নয়। শুধু credential দিলেই চালু হবে না। Manual payment/refund নিজে বাইরে যাচাই করতে হবে; সফটওয়্যার টাকা পাঠায় না।
- Vercel-এ database-এর জন্য MongoDB, স্থায়ী ছবির জন্য Vercel Blob এবং admin invitation/reset email-এর জন্য Resend সেটআপ দরকার। আসল deployment-এর আগে backup, staging test ও অনুমোদন প্রয়োজন।
- পুরোনো USD বা currency-অজানা তথ্য নিজের মতো BDT-তে বদলাবেন না।

## ৫. যাচাই

```bash
npm run typecheck
npm run test:unit
npm run lint
npm run build
```

Browser test লোকাল disposable database-এ চালানোর নিয়ম `REMAINING_TASKS.md`-এ আছে। লাইভ database বা নিজের গুরুত্বপূর্ণ `.data` দিয়ে ওই test চালাবেন না। বিস্তারিত: `README.md`, `ADMIN_GUIDE.md`, `DEPLOYMENT_GUIDE.md`।
