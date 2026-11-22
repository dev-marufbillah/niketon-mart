# GitHub `main` বনাম এই reconstructed source

## কোন repository দেখা হয়েছে

Vercel-এর সংযুক্ত project metadata অনুযায়ী repository হলো **`dev-marufbillah/niketon-mart`**, branch `main`। Public read-only clone-এ পাওয়া revision: **`892500c4d5a335dd34ecbc9ee5680f26f40dd944`**, commit message `Remove private environment file`। আগের নোটে লেখা `dev-maruf/niketon-mart` থেকে এই নাম আলাদা; push করার আগে মালিককে সঠিক repository নিশ্চিত করতে হবে। এটি কেবল উল্লিখিত revision-এর তুলনা; এরপর `main` বদলে যেতে পারে। কোনো push, merge, force-push, Vercel setting পরিবর্তন বা deployment করা হয়নি।

## সবচেয়ে গুরুত্বপূর্ণ ফল

এই ZIP আগের একটি আলাদা workspace থেকে reconstructed। শুধু কয়েকটি পরিবর্তন নয়: linked `main`-এর সঙ্গে এই codebase-এর গঠন, authentication এবং database schema উল্লেখযোগ্যভাবে ভিন্ন। আগের path/hash তুলনায় ২২৯টি remote tracked file-এর সঙ্গে তখনকার ৪৪২টি local release file-এর ০টি identical, ১২টি বদলানো, ২১৭টি remote-only ও ৪৩০টি local-only ছিল; পরে এই ZIP-এ আরও কিছু file যোগ হয়েছে। এটি semantic equivalence বা পূর্ণ security audit নয়। **ZIP extract করে main-এর ওপরে সব ফাইল বসাবেন না।** এতে remote-only features হারাতে পারে এবং live data বা authentication ভেঙে যেতে পারে।

| বিষয় | Linked `main` | এই ZIP | ঝুঁকি / করণীয় |
|---|---|---|---|
| Architecture | Next.js catch-all routes, `src/server`, Mongoose ও Better Auth | আলাদা App Router pages, `src/lib/repositories`, Mongo/file adapters ও custom sessions | Remote history সংরক্ষণ করে reviewer-কে feature-by-feature port ও test করতে হবে; সরাসরি replace নয়। |
| Identity | Better Auth `users`, `accounts`, `sessions`, `verifications`; Google ও Facebook provider code | পৃথক `customers`, `admin_users`, customer/admin sessions; customer-only Google | User ID, password/session ও linked providers compatible ধরে নেওয়া যাবে না। Account ownership প্রমাণ, user consent ও verified recovery ছাড়া account merge করা যাবে না। Facebook পূর্ববর্তী remote feature; এই ZIP-এ নেই। |
| Product ও order | Mongoose `products`/`orders`, Mongo `_id`, product `slug`, order `userId`, আলাদা item/address/status structure | String `id`, category IDs, আলাদা order/customer/stock/ledger structure এবং BDT snapshots | Shared collection নাম একই হলেও documents সামঞ্জস্যপূর্ণ নয়। Historical order, product, stock ও currency-এর reviewed migration/reconciliation ছাড়া একই DB ব্যবহার করবেন না। |
| Checkout/payment | Remote-এ transaction checkout এবং SSLCommerz provider code আছে | পরীক্ষামূলক Mongo transaction; production checkout held; gateway scaffold বাস্তব provider নয় | Remote code থাকা মানেই live payment বা refund প্রমাণ নয়। প্রয়োজনীয় verified provider flow নিরাপদে পুনরায় সংযুক্ত/পরীক্ষা করতে হবে। |
| Images | Remote-এ Mongo `mediaFiles` binary বা Cloudinary এবং `/api/media/<id>` delivery code আছে | Vercel-এ Blob প্রয়োজন; ভিন্ন media references | পুরোনো image records/URLs-এর backup ও reviewed migration বা compatibility layer ছাড়া ছবি হারাতে পারে। এই ZIP Mongo-তে Base64 বা Vercel local filesystem-এ স্থায়ী upload করে না। |
| Operations | Remote-এর নিজস্ব backup/restore, doctor, launch/test scripts ও documentation আছে | ভিন্ন tools/guide; remote scripts এই ZIP-এ port করা হয়নি | Verified backup/restore এবং প্রয়োজনীয় operational tools preserve/port/test করুন; কোনো পুরোনো রিপোর্টকে বর্তমান test pass ধরবেন না। |
| Corporate/workplace | Remote source-এ workplace ও corporate business modules আছে | মালিকের অনুরোধে এই reconstructed source-এ সেগুলো সরানো হয়েছে | Feature না ফিরিয়েও historical corporate data/archive ব্যক্তিগতভাবে সংরক্ষণ করতে হবে; অনুমতি ছাড়া delete নয়। |

এই তুলনায় path-based অসামঞ্জস্য ও কয়েকটি গুরুত্বপূর্ণ workflow পর্যালোচনা করা হয়েছে; remote-এর সব feature port হয়েছে এমন দাবি নয়। বিশেষত remote-এর Facebook, SSLCommerz, পুরোনো media URLs, Better Auth recovery/verification, backup/restore এবং API contract-এর জন্য আলাদা সিদ্ধান্ত ও implementation দরকার।

## Database নিরাপত্তা

এই আপডেটে `src/lib/db/mongo-compatibility.ts` একটি **read-only tripwire** যোগ হয়েছে। Index তৈরির আগেই পরিচিত Better Auth/Mongoose collections-এ record বা shared collection-এ বেমানান ID পেলে startup বন্ধ করে। Local Mongo-তে refusal-এর সময় data/index অপরিবর্তিত থাকার পরীক্ষা হয়েছে। এটি exhaustive schema audit, migration বা কোনো DB নিরাপদ হওয়ার সার্টিফিকেট নয়; অচেনা schema এড়াতে নাও পারে এবং একসঙ্গে অন্য কেউ write করলে race থাকতে পারে। এই source compatible/empty DB-তেও index বা seed তৈরি করতে পারে। **Live database-এ এই ZIP চালাবেন না।**

## নিরাপদ পরবর্তী ধাপ

1. সঠিক GitHub owner/repository ও target revision নিশ্চিত করুন; আবার fetch করে `main` পরিবর্তিত হয়েছে কি না পরীক্ষা করুন। Git-এর history ও remote-only কাজ সংরক্ষণ করুন।
2. Production DB/media ও repository-এর private backup নিন; আলাদা জায়গায় restore test করুন। পূর্বে প্রকাশিত Mongo credential revoke/rotate করুন।
3. Existing data, historical currency, protected owner ও provider identities-এর mapping এবং feature-preservation checklist তৈরি করে owner-এর অনুমোদন নিন। Corporate data delete বা অর্থ convert/relabel অনুমোদন ছাড়া নয়।
4. সম্পূর্ণ আলাদা, খালি এবং least-privilege staging database-এ migration rehearsal, concurrency/failure ও বাস্তব provider/security test চালান। Manual cancellation review ও refund workflow সম্পূর্ণ করুন।
5. Reviewed diff অনুমোদনের পর non-force Git push; **তারপরেই** Vercel settings/deployment বিবেচনা। এই ZIP-এর checkout ও cancellation hold নিজে থেকে খুলবেন না।
