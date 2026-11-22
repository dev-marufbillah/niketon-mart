# Niketon Mart: Git push ও Vercel deploy — এখন কী করবেন

## বর্তমান অবস্থা

- Vercel-এ `niketon-mart` প্রকল্প পাওয়া গেছে। এর production deployment এখন GitHub-এর `dev-marufbillah/niketon-mart` repository-এর `main` branch-এর `892500c4d5a335dd34ecbc9ee5680f26f40dd944` commit ব্যবহার করছে। Vercel-এর `READY` মানে build তৈরি হয়েছে; এটি সব অর্ডার, পেমেন্ট বা ব্যবসায়িক ফিচার পরীক্ষা হয়ে গেছে এমন প্রমাণ নয়।
- এই workspace-এর পরিবর্তিত source একই repository-এর checkout নয়। এর login, database model ও অন্য ফাইলগুলো GitHub-এর বর্তমান প্রকল্প থেকে অনেক আলাদা। সরাসরি ZIP-এর ফাইল কপি করে `main`-এ push করলে বর্তমানে থাকা ফিচার নষ্ট বা বাদ যেতে পারে এবং database মেলানো ছাড়া ব্যবহার করলে সাইট অচল হতে পারে।
- এই সেশনে GitHub-এ লেখার অনুমতি পাওয়া যায়নি: নিরাপদ `git push --dry-run` লগইন না থাকায় ব্যর্থ হয়েছে। এটি কোনো branch পরিবর্তন করেনি। Vercel সংযুক্ত থাকলেই GitHub-এ লেখার অনুমতি পাওয়া যায় না।
- **কোনো নতুন Git push, Vercel deploy, Vercel settings পরিবর্তন বা live database write করা হয়নি।** মালিক deploy করার ইচ্ছা জানিয়েছেন; কিন্তু এই অসামঞ্জস্য, backup ও পরীক্ষার বাধাগুলো আগে সমাধান করা দরকার।

## আপনার যা করতে হবে

1. **এখনই পুরোনো বা নতুন ZIP `main`-এ আপলোড/পেস্ট করবেন না।** `git push --force` দেবেন না এবং database reset বা migration চালাবেন না। বর্তমান `main`-এ push করলে Vercel-এর configuration অনুযায়ী deploy স্বয়ংক্রিয়ভাবেও শুরু হতে পারে।
2. নিজের কম্পিউটারে GitHub Desktop বা VS Code-এ `dev-marufbillah` GitHub account-এ sign in করুন। এই সেশনে GitHub connector উপলব্ধ নয়, তাই প্রয়োজন হলে যাচাই করা final পরিবর্তন আপনাকেই push করতে হবে। **GitHub password, personal access token বা MongoDB URI চ্যাটে পাঠাবেন না।**
3. বাস্তব MongoDB/ব্যবসায়িক ডেটার নিরাপদ backup নিন এবং আলাদা test database-এ restore পরীক্ষা করুন। আগে চ্যাটে প্রকাশিত MongoDB credential পরিবর্তন করুন। কোনো মূল্য, পুরোনো অর্ডার বা মুদ্রা স্বয়ংক্রিয়ভাবে রূপান্তর/মুছে ফেলবেন না।
4. GitHub-এর প্রকৃত `main` ভিত্তি করে এখানে করা পরিবর্তনগুলো ফাইল ও ফিচার অনুযায়ী একীভূত করতে হবে; বিদ্যমান Better Auth, Mongoose model, checkout ও remote-only ফিচার ধরে রাখতে হবে। আমি এই integration ও পরীক্ষার কাজে সাহায্য করতে পারি। এটি এখনও সম্পন্ন হয়নি।
5. একীভূত source নিয়ে আলাদা test database, provider test এবং browser-এ যাচাই করুন। Preview পরিবেশে live database credentials ব্যবহার করবেন না। Real email, Google, storage, delivery ও payment পরীক্ষা না হওয়া পর্যন্ত কাজ করছে বলে ধরে নেবেন না।
6. সব পরিবর্তন ও নিরাপত্তা যাচাই শেষে আপনার কম্পিউটার থেকে অনুমোদিত branch-এ commit ও **Git push আগে** করুন। `main`-এ সরাসরি push শুধু পর্যালোচিত integration-এর জন্য; force push নয়।
7. তারপর Vercel-এর Deployments-এ নতুন commit-এর deployment হয়েছে কি না দেখুন। না হলে push-এর পরে ওই নতুন commit থেকেই deployment তৈরি করতে হবে; পুরোনো deployment-এ Redeploy চাপলে নতুন code আসবে এমন নিশ্চয়তা নেই। প্রয়োজন হলে আমি সংযুক্ত Vercel দিয়ে সঠিক commit deploy করার চেষ্টা করতে পারি। আপনি নিজে Vercel-এ প্রয়োজনীয় environment variables দেবেন; সেগুলোর মান চ্যাটে দেবেন না।

## নিজের PC-তে repository নিরাপদে নামাতে চাইলে

নতুন খালি directory-তে Terminal/PowerShell খুলে নিচের কমান্ড দিন। এতে শুধু GitHub-এর বর্তমান source আপনার PC-তে নামে; এটি integration, push বা deployment নয়:

```bash
git clone https://github.com/dev-marufbillah/niketon-mart.git niketon-mart-review
cd niketon-mart-review
git status
```

এরপর কোনো ZIP কপি বা push না করে integration প্রস্তুত ও যাচাই হওয়া পর্যন্ত অপেক্ষা করুন। আপনার আগে থেকে থাকা কাজের folder মুছবেন না।

## কী এখনও প্রস্তুত নয়

Reconstructed source-এ production checkout ইচ্ছাকৃতভাবে বন্ধ; অনলাইন cancellation-এর জন্য প্রয়োজনীয় staff review/refund/accounting workflow সম্পূর্ণ নয়। Actual GitHub `main`-এর আচরণ আলাদা এবং এসব hold সেখানে আছে বলে দাবি করা যায় না। এগুলো, live database compatibility ও তৃতীয় পক্ষের পরিষেবাগুলো যাচাই ছাড়া নতুন release-কে production-ready বলা যাচ্ছে না।
