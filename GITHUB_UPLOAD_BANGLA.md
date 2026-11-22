# ZIP থেকে GitHub-এ নেওয়ার সহজ নির্দেশনা

এই ZIP-এ প্রজেক্টের **source code** আছে; `.env.local`, database, runtime uploads, `node_modules` ও build cache নেই। এটি আগে পাওয়া ZIP থেকে পুনর্গঠিত, তাই আপনার বিদ্যমান repository বা live site-এর সঙ্গে এক ধরে নেবেন না। Production checkout ও online cancellation এখনও বন্ধ; কেবল GitHub-এ upload করলেই বাস্তব অর্ডার নেওয়া নিরাপদ হবে না।

## সবচেয়ে নিরাপদ প্রথম ধাপ: নতুন private repository-তে সোর্স রাখা

1. ZIP extract করুন। ভেতরের `grocery-website` ফোল্ডার খুলুন; সেখানে `package.json`, `.gitignore` ও `src` আছে কি না দেখুন। ZIP ফাইলটি নিজে upload না করে এই ফোল্ডারের **ফাইলগুলো** Git দিয়ে নিন।
2. GitHub-এ একটি **নতুন private, empty repository** তৈরি করুন। README, `.gitignore` বা license দিয়ে আগে থেকে initialize করবেন না। এটিকে এখনই Vercel-এর production project-এর সঙ্গে যুক্ত করবেন না।
3. Git ইনস্টল ও GitHub login করুন। Windows-এ `grocery-website` ফোল্ডারে PowerShell/Terminal খুলুন। নিচের commands চালান:

```powershell
git init
git branch -M main
git add .
git status --short
git check-ignore -v .env.local
git commit -m "Add Niketon Mart source"
```

`git status --short` দেখে নিশ্চিত করুন `.env.local`, `.env`, `.data`, `public/uploads`, archive ও কোনো private credential তালিকায় নেই। `.env.example` একটি খালি template, এটি রাখা যায়। `git check-ignore`-এ `.env.local`-এর জন্য `.gitignore` নিয়ম দেখানোর কথা। Git নাম/email চাইলে আপনার GitHub profile-এর নাম/email দিয়ে কনফিগার করুন।

4. নতুন repository-র GitHub page থেকে নিজের HTTPS URL কপি করুন। নিচের জায়গায় **নিজের URL** বসিয়ে push করুন:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/YOUR-NEW-PRIVATE-REPOSITORY.git
git push -u origin main
```

GitHub authentication browser/Git Credential Manager দিয়ে করুন; token, password বা private key chat-এ পাঠাবেন না। `.gitignore` আগে থেকে Git-এ tracked হয়ে থাকা গোপন ফাইল বা পুরোনো Git history থেকে কোনো secret সরায় না। কখনও ভুল করে প্রকাশ পেলে সেই credential revoke/rotate করতে হবে এবং history আলাদাভাবে পর্যালোচনা করতে হবে।

## আপনার বিদ্যমান Vercel-সংযুক্ত repository

Vercel-এ সংযুক্ত repository `dev-marufbillah/niketon-mart`-এর `main` revision `892500c4d5a335dd34ecbc9ee5680f26f40dd944` read-only তুলনা করা হয়েছে। আগের নোটে `dev-maruf/niketon-mart` লেখা ছিল; push করার আগে মালিককে সঠিক নাম নিশ্চিত করতে হবে। তুলনায় authentication, database schema ও একাধিক feature-এ বড় পার্থক্য পাওয়া গেছে: `docs/GITHUB_MAIN_COMPARISON.md` দেখুন। এটি **merge নয়**।

নতুন ZIP দিয়ে `main` **blindly overwrite, force-push বা delete করবেন না**। আবার fetch করে নতুন পরিবর্তন আছে কি না দেখুন; remote-only কাজ ও history রেখে feature-by-feature reviewed integration করুন। `main` push করলে স্বয়ংক্রিয় deploy শুরু হতে পারে—আগে যাচাই করুন। Backup, staging ও launch review ছাড়া production site/data-তে এই version চালাবেন না। Git push-এর আগেই Vercel deploy বা settings পরিবর্তন নয়।

## লোকালে চালাতে চাইলে

Node.js 20.9+ ও npm লাগবে। Extract করা `grocery-website` ফোল্ডারে:

```powershell
npm ci
Copy-Item .env.example .env.local
# .env.local খুলে নিজের নতুন ও গোপন SUPER_ADMIN_PASSWORD লিখুন।
npm run dev
```

`http://localhost:3000` খুলুন। Mongo URI না দিলে নতুন local development store-এ শুধু demo data থাকবে; এগুলো আপনার বাস্তব ব্যবসার তথ্য নয়। `.env.local` নিজের কম্পিউটারে রাখুন; GitHub-এ upload করবেন না।

## Live করার আগে

আগে প্রকাশ পাওয়া Mongo credential rotate/revoke করুন। Database-এর private backup ও restore test, বাস্তব `main`-এর বিশদ feature/data migration review, production data/currency/identity review, transactional checkout ও manual cancellation review-এর কাজ এবং পৃথক staging-এ MongoDB, Google, Blob, email ও payment/security পরীক্ষা দরকার। তারপর অনুমোদিত Git push; প্রয়োজনীয় server-side configuration আপনি নিজে নিরাপদে দিন, chat-এ নয়। বিস্তারিত: `PROJECT_STATUS_BANGLA.md`, `REMAINING_TASKS.md`, `DEPLOYMENT_GUIDE.md`, `docs/STOREFRONT_CATEGORIES_BANGLA.md`।
