# Google login: সেটআপ ও বর্তমান অবস্থা

## কী যুক্ত হয়েছে

- বিদ্যমান shared sign-in এবং register পৃষ্ঠায় Google-এর নিজের প্রি-অ্যাপ্রুভড সাদা pill বোতাম ব্যবহৃত হয়েছে। উৎস: <https://developers.google.com/identity/branding-guidelines> এবং Google-এর `signin-assets.zip` (Android + Web, light, pill, 4x PNG)। এটি কোনো ইমোজি বা নিজে বানানো Google logo নয়।
- Google OpenID Connect authorization-code flow, PKCE, state, nonce, স্বল্পমেয়াদি স্বাক্ষরিত HttpOnly cookie এবং Google-এর `google-auth-library` দিয়ে ID-token signature, issuer, audience ও expiry পরীক্ষা করা হয়। আলাদাভাবে verified email ও nonce পরীক্ষা করা হয়। Google access/ID/refresh token database-এ রাখা হয় না।
- Google দিয়ে **customer** account খোলে/লগইন হয়। এটি কোনো অবস্থাতেই staff/admin session তৈরি করে না; staff আগের password দিয়েই লগইন করবেন। নিষ্ক্রিয় customer-কে login দেওয়া হয় না।
- আগে password দিয়ে account থাকলে কেবল email মিলিয়ে account দখল/merge হয় না। আগে সেই customer account-এ password দিয়ে login করে Personal Information → Google sign-in থেকে বর্তমান password নিশ্চিত করে একই email-এর Google account connect করতে হবে। Password ও Google উভয় থাকলে একই জায়গায় password নিশ্চিত করে disconnect করা যায়; পুরোনো Google session অকেজো হয়। Google-only account disconnect করে lockout এড়াতে store-এর সাহায্য লাগবে। অতিথির পুরোনো order বা profile স্বয়ংক্রিয়ভাবে যুক্ত হয় না।
- বিদ্যমান Customers admin-এ Google account registered হিসেবে দেখায়; account status ও session-management আগের permission-যুক্ত সিস্টেমেই থাকে। OAuth secret ইচ্ছাকৃতভাবে admin UI বা browser-এ দেখানো/এডিট করা হয় না: ব্যবহারকারীর অনুরোধ অনুযায়ী এটি server environment-এ থাকে।

## আপনার দেওয়া environment file সম্পর্কে

এই কাজের সময় ব্যবহারকারীর কোনো private environment file/path পাওয়া যায়নি; তাই তার মান কপি করা হয়নি বা অনুমান করা হয়নি। Workspace-এ `.env.example` থেকে `.env.local` তৈরি হয়েছে, local cookie secret তৈরি হয়েছে, কিন্তু Google Client ID, Client Secret এবং Mongo URI খালি। `.env.local` permission `600`; `.gitignore` সেটিকে বাদ দেয়। ZIP-এ কোনো `.env.local` নেই।

আপনার ফাইলটি workspace-এর project-এর বাইরে নিরাপদ স্থানে রাখুন এবং **শুধু তার পূর্ণ path** দিন। Chat-এ password, API key, Mongo URI, OAuth secret দেবেন না। আগের chat-এ প্রকাশ পাওয়া Mongo credential production-এর আগে rotate করুন। ফাইল পাওয়া ও যাচাইয়ের পর প্রয়োজনীয় সব variable নিরাপদে একীভূত করা যাবে; অচেনা variable বা অবাস্তব integration কাজ করছে এমন দাবি করা যাবে না।

## Google Cloud Console-এ আপনার কাজ

1. যথাযথ Google Cloud project-এ OAuth consent screen (app name, support email, privacy policy, authorised domain) ঠিক করুন। App testing অবস্থায় প্রয়োজনীয় test account-কে test users হিসেবে দিন। প্রয়োজন হলে Google app verification সম্পন্ন করুন।
2. **OAuth client ID → Web application** তৈরি করুন। লোকাল পরীক্ষার জন্য exact **Authorized redirect URI** দিন:
   `http://localhost:3000/api/auth/google/callback`
3. পরীক্ষার Google account ও Client ID/Client Secret যোগ করতে হবে। নিজস্ব production domain থাকলে তার সঠিক HTTPS callback, উদাহরণ `https://your-domain.example/api/auth/google/callback`, Google-এ ও server environment-এ আলাদাভাবে সেট করতে হবে। উদাহরণের domain ব্যবহার করবেন না। Origin এবং callback ঠিকমতো মেলা জরুরি; ভুল হলে Google `redirect_uri_mismatch` দেবে।
4. Private `.env.local`-এ `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_OAUTH_COOKIE_SECRET` রাখুন; কোনো key-এ `NEXT_PUBLIC_` যুক্ত করবেন না। Cookie secret এলোমেলো ও অন্তত ৩২ byte হতে হবে; একটি আলাদা শক্তিশালী secret production ও প্রতিটি environment-এর জন্য ব্যবহার করুন। Local `.env.local`-এ অনুপস্থিত key placeholder হিসেবে রাখা আছে।
5. Dev server restart করুন; login/register পৃষ্ঠার active Google button দিয়ে নিজের test account-এ বাস্তব login পরীক্ষা করুন। একই email-এর পুরোনো password account হলে আগে password দিয়ে লগইন করে connect করুন।

`.env.local` GitHub-এ পাঠানো হবে না, তাই Vercel সেটি নিজে থেকে পাবে না। **প্রথমে অনুমোদিত branch-এ Git push**, তারপরই প্রয়োজনীয় server-side environment values Vercel-এ নিরাপদে যোগ এবং staging test/deploy বিবেচনা করা যাবে। এই কাজে কোনো Git push, Vercel setting বা deploy করা হয়নি। `.gitignore` নতুন/untracked file রক্ষা করে; কোনো secret আগে Git-এ tracked বা push হয়ে থাকলে কেবল ignore নিয়ম তাকে history থেকে সরায় না—credential rotate ও অনুমোদিত history cleanup দরকার।

## পরীক্ষা ও সতর্কতা

Local automated tests-এ HMAC/state/expiry, PKCE, আসল Google library দিয়ে স্থানীয় test key-সই করা token-এর signature/issuer/audience/expiry, nonce ও verified-email rejection, password-account linking, blocked account, guest/staff isolation, local subject-uniqueness race এবং disconnect/session version পরীক্ষা করা হয়েছে। Marked local browser store-এ পাঁচটি focused smoke group-এ fake Google start, invalid/cancelled callback, 320/390/1366px বোতাম, password signup/link reauthentication এবং staff password login পাস করেছে। Production-mode local smoke-এ config ছাড়া Google button নিষ্ক্রিয় থাকে। এই signed token **Google থেকে আসেনি**: Google-এর আসল consent screen, token exchange, account, SMTP বা Atlas পরীক্ষা নয়।

Mongo driver registered customer-এর case-insensitive email এবং Google subject-এর জন্য partial unique index তৈরি করে। Isolated local Mongo-তে একই email/subject-এর signup ও link race পরীক্ষা পাস করেছে; প্রথম staging ব্যবহারের আগে backup ও legacy invalid/duplicate identity/index review দরকার। Local file driver কেবল একই process-এর concurrency নিরাপদ করে। Distributed rate limit, link/session ও password-change concurrent edge cases, production domain/security review এবং actual Google/Mongo বহু-instance integration test এখনও বাকি। User data বা production credentials দিয়ে destructive test চালাবেন না। Production checkout ও cancellation-এর আগের hold অপরিবর্তিত।
