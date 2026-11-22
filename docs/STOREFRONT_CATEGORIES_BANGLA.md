# Storefront categories ও filters পরিচালনা

এই পরিবর্তন বিদ্যমান **Admin → Catalogue → Taxonomy** এবং **Catalogue → Products** ব্যবহার করে; আলাদা admin বা পণ্যের তালিকা তৈরি করে না। দোকানের তথ্য ও ছবির জন্য আগেরই database/upload configuration প্রযোজ্য।

## Admin কী করবেন

1. Taxonomy-তে একটি category যোগ বা edit করুন। **Navigation group**-এ `Fresh Market` দিলে category ও তার subcategory Fresh Market-এ যাবে; `Grocery & Essentials`, `Household` বা `Bakery` দিলে Grocery-তে যাবে। পরে মূল category-র group পরিবর্তন করলে তার child-ও সেই group অনুসরণ করে।
2. Variety/subcategory যোগ করতে **Parent category** বেছে নিন। Products-এ পণ্যের **Category / subcategory**, brand, product type, মূল্য, stock, ছবি ও visibility ঠিক করে সেভ করুন। যে category-তে কোনো পণ্য নেই, সেখানে সিস্টেম নিজে পণ্য বা মূল্য বানায় না।
3. Homepage-এ মূল category দেখাতে **Show on homepage** চালু করুন। ছবি না দিলে প্রকাশিত কোনো সম্পর্কিত পণ্যের ছবি, নতুবা নিরপেক্ষ placeholder দেখাবে। Desktop-এ cards বড় হয়ে একাধিক সারিতে যায়; mobile-এ আগের horizontal rail থাকে।
4. Dates-এর মতো একটিমাত্র category-কে top navigation-এ রাখতে **Show in category navigation** ও **Feature in primary navigation** চালু করুন। আগে অন্য কোনো category featured থাকলে সেটির feature বন্ধ করুন। ওই link এবং homepage-এ তার featured tile থেকে category ও তার children-এর পণ্য এবং কেবল সংশ্লিষ্ট filters দেখা যাবে। Category-র নাম/বিবরণ তার নিজের admin record থেকে আসে।
5. **Show subcategories as filters only** দিয়ে কোনো category family-র illustrated Explore cards বন্ধ রেখে শুধু scoped filters দেখাতে পারবেন। Featured category-তে এটি চালু থাকে; পরে top menu থেকে সরালেও checkbox চালু থাকলে আচরণ বজায় থাকে। বন্ধ করলে অন্য সাধারণ category-র মতো cards আবার দেখা যাবে। পুরোনো record-এ featured থাকা অবস্থায় save করলে এই preference সংরক্ষিত হয়।
6. Category `hidden` করলে তার পণ্য ও children প্রকাশ্যে দেখাবে না। শুধু **Show in category navigation** বন্ধ করলে menu item লুকায়; দৃশ্যমান category এবং পণ্য filter-এ থাকবে। পুরোনো explicit family-scope URL-এ category hidden বা অন্য department-এ সরানো থাকলে সেটি 404 হবে; অন্য পণ্য দেখাতে scope খুলে দেওয়া হবে না।

## Customer experience

- **Shop** সব প্রকাশিত/দৃশ্যমান category-র পণ্য দেখায়; pagination ও search/filter প্রযোজ্য। **Fresh Market**, **Grocery**, এবং featured category-র page প্রত্যেকে নিজস্ব পণ্য থেকে brand, product type, price, review ও stock filter তৈরি করে। Category filter-এ শূন্য-পণ্যের দৃশ্যমান category-ও দেখা যায়, কিন্তু তার জন্য পণ্য বানানো হয় না।
- Featured বা **filters only** বেছে নেওয়া category-তে (যেমন Dates) children illustrated Explore cards-এর বদলে Category filter-এ থাকে। Parent বেছে নিলে children-এর পণ্যও আসে; child বেছে নিলে parent selection বদলে ওই child-এ সীমিত হয়। Clear all, reload ও share করা URL-এ family scope থাকে। Filter counts ওই page-এর প্রকাশিত catalogue থেকে আসে; এগুলো stock quantity নয়।
- English navigation: Home → Shop → Categories → Fresh Market → Grocery → optional featured category → About Us। Blog footer-এ থাকে। নতুন page/query link-এর জন্য top-এ পৌঁছানো, filter-এর সময় বর্তমান অবস্থান, Back/Forward ও fragment link আলাদাভাবে পরীক্ষা করতে হবে।

## Deploy সতর্কতা

Local demo-র Dates ও নামগুলো কেবল নতুন demo file store-এর উদাহরণ; existing বা production database-এ স্বয়ংক্রিয়ভাবে বসানো হয় না। Live store-এ admin থেকে প্রয়োজনীয় taxonomy ও বাস্তব পণ্য যুক্ত করতে হবে। এই storefront কাজ production checkout চালু করে না। Live order, ডেটার backup/মাইগ্রেশন review, transaction ও real-service staging, authenticated Git comparison ও `main`-এ push—এসব আগের release gate অনুসারে বাকি। Git push-এর আগে Vercel deployment বা settings পরিবর্তন করবেন না।
