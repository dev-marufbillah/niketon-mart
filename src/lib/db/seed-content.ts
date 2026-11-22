import type { Row } from "@/lib/db/types";
import type { PostBlock } from "@/lib/repositories/content";

/**
 * Blog, FAQ and CMS-page seed
 * ---------------------------
 * These rows are written once, on first run, and then belong to the admin panel.
 * Blog bodies are stored as typed blocks so the article page can render headings,
 * images, lists, callouts and step cards without any HTML in the database.
 */

const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString().slice(0, 10);

export const blogCategoriesSeed: Row[] = [
  { id: "bc_shopping", name: "Shopping Tips", slug: "shopping-tips", description: "Plan the week, waste less, spend smarter.", visible: true, order: 1 },
  { id: "bc_grocery", name: "Grocery", slug: "grocery", description: "How our aisles and store work.", visible: true, order: 2 },
  { id: "bc_produce", name: "Fruits & Vegetables", slug: "fruits-vegetables", description: "Seasonal picks and how to store them.", visible: true, order: 3 },
  { id: "bc_organic", name: "Organic Food", slug: "organic-food", description: "Growing, sourcing and understanding organic produce.", visible: true, order: 4 },
  { id: "bc_bakery", name: "Bakery Products", slug: "bakery-products", description: "Bread, bakes and keeping them fresh.", visible: true, order: 5 },
];

export const authorsSeed: Row[] = [
  {
    id: "au_jenny",
    name: "Jenny Alexander",
    role: "Founder & CEO",
    bio: "Jenny started Niketon Mart with one delivery route and a spreadsheet. She still picks the produce list every Monday and writes about how the store buys.",
    avatar: "/images/avatars/avatar-3.jpg",
    visible: true,
    order: 1,
  },
  {
    id: "au_bessie",
    name: "Bessie Cooper",
    role: "Operations Manager",
    bio: "Bessie runs the packing floor and the delivery windows. She writes about storage, freshness and what actually survives a fridge drawer.",
    avatar: "/images/avatars/avatar-1.jpg",
    visible: true,
    order: 2,
  },
  {
    id: "au_marcus",
    name: "Marcus Reid",
    role: "Produce Buyer",
    bio: "Marcus spends his mornings at the wholesale market. He writes the seasonal guides and the buying notes behind every produce listing.",
    avatar: "/images/avatars/avatar-2.jpg",
    visible: true,
    order: 3,
  },
];

export const faqCategoriesSeed: Row[] = [
  { id: "fc_general", name: "General Information", slug: "general-information", description: "The basics about shopping with us.", visible: true, order: 1 },
  { id: "fc_ordering", name: "Ordering and Payment", slug: "ordering-and-payment", description: "Placing an order and paying for it.", visible: true, order: 2 },
  { id: "fc_delivery", name: "Delivery and Pickup", slug: "delivery-and-pickup", description: "Windows, areas and what happens at the door.", visible: true, order: 3 },
  { id: "fc_products", name: "Products and Availability", slug: "products-and-availability", description: "Freshness, stock and substitutions.", visible: true, order: 4 },
  { id: "fc_account", name: "Account & Profile", slug: "account-and-profile", description: "Your details, your orders, your preferences.", visible: true, order: 5 },
];

/** FAQ → category map used by the seed (ids match `faqs` in lib/data/content.ts). */
export const faqCategoryAssignments: Record<string, string> = {
  "f-1": "fc_products",
  "f-2": "fc_delivery",
  "f-3": "fc_ordering",
  "f-4": "fc_ordering",
  "f-5": "fc_general",
  "f-6": "fc_delivery",
  "f-7": "fc_account",
  "f-8": "fc_products",
};

const steps = (items: { title: string; text: string }[]) => ({ type: "steps" as const, items });

export const postsSeed: (Row & {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  categoryId: string;
  author: string;
  authorId: string;
  publishedAt: string;
  image: string;
  readTime: string;
  body: string;
  blocks: PostBlock[];
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  status: "published" | "draft";
  visible: boolean;
  order: number;
})[] = [
  {
    id: "b-1",
    slug: "create-a-grocery-shopping-list",
    title: "How to Create a Grocery Shopping List: Stay Organized and Efficient",
    excerpt: "A simple weekly system that keeps your pantry full and your budget intact.",
    category: "Shopping Tips",
    categoryId: "bc_shopping",
    author: "Jenny Alexander",
    authorId: "au_jenny",
    publishedAt: daysAgo(9),
    image: "/images/blog/blog-1.jpg",
    readTime: "5 min read",
    body: "A grocery list is only useful if you can plan a week from it. Start with the meals you will actually cook, then work backwards to the ingredients.",
    tags: ["meal planning", "budget", "weekly shop"],
    seoTitle: "How to create a grocery shopping list that works",
    seoDescription:
      "Build a weekly grocery list around real meals, a running pantry check and a supermarket order that follows the store layout.",
    status: "published",
    visible: true,
    order: 1,
    blocks: [
      {
        type: "paragraph",
        text: "Most grocery lists fail for the same reason: they are written in the shop, not in the kitchen. A list built around the meals you will actually cook this week — and the shelves you already have — costs less and gets used.",
      },
      { type: "heading", level: 2, text: "1. Start with the week, not the list" },
      {
        type: "paragraph",
        text: "Write down five dinners and two lunches before you open the shop. Everything else on the list is either a repeat purchase or a gap those meals will fill.",
      },
      { type: "heading", level: 2, text: "Importance of an Organized Grocery Shopping List" },
      {
        type: "list",
        ordered: false,
        items: [
          "You stop buying a fourth jar of something you already have two of.",
          "Shopping takes less time because the list follows the aisles.",
          "Substitutions are easier when you know which meal the item belongs to.",
        ],
      },
      { type: "heading", level: 2, text: "Evaluate Your Current Inventory" },
      {
        type: "paragraph",
        text: "Ten minutes with the fridge door open and the pantry shelf cleared saves a whole extra trip. Anything within two days of its date moves to the front of your list.",
      },
      {
        type: "image",
        src: "/images/lifestyle/strip-3.jpg",
        alt: "A bowl of fresh fruit and vegetables on a counter",
        caption: "Check what is already on the shelf before planning the week.",
      },
      {
        type: "columns",
        items: [
          {
            title: "Categorize Your Grocery List",
            text: "Group items the way the store is laid out — produce, dairy, pantry, frozen — so you make one loop instead of four.",
          },
          {
            title: "Use a Shared List",
            text: "One list per household, editable by everyone. The person closest to the shop picks it up.",
          },
        ],
      },
      {
        type: "callout",
        title: "Must Read",
        text: "The Benefits of Drinking Herbal Tea",
        href: "/blogs/summer-produce-guide",
        label: "Read the guide",
      },
      { type: "heading", level: 2, text: "Focus on Seasonal and Fresh Produce" },
      {
        type: "paragraph",
        text: "Seasonal produce is cheaper, travels less and tastes better. If a vegetable is not in season, the list should offer a swap rather than an empty slot.",
      },
      steps([
        { title: "Health Benefits", text: "Seasonal fruit arrives riper because it does not have to survive long storage." },
        { title: "Cost", text: "In-season crops are the cheapest thing in the aisle most weeks." },
        { title: "Taste", text: "Produce picked at its peak needs less work in the kitchen." },
      ]),
      { type: "heading", level: 2, text: "Tips for an Efficient Shopping Experience" },
      {
        type: "list",
        ordered: true,
        items: [
          "Order the list by the route you walk, not alphabetically.",
          "Set a quantity for staples so you can see when something is running low.",
          "Keep a 'next time' note for anything the shop was out of.",
          "Review the list after the shop — that is the plan for next week.",
        ],
      },
      {
        type: "quote",
        text: "A list you can explain to someone else is a list that survives contact with a busy Tuesday.",
        by: "Jenny Alexander",
      },
    ],
  },
  {
    id: "b-2",
    slug: "summer-produce-guide",
    title: "Summer Produce Guide: Fresh Fruits and Vegetables to Enjoy",
    excerpt: "What is at its peak right now, how to pick it and how to store it longer.",
    category: "Fruits & Vegetables",
    categoryId: "bc_produce",
    author: "Marcus Reid",
    authorId: "au_marcus",
    publishedAt: daysAgo(14),
    image: "/images/blog/blog-2.jpg",
    readTime: "7 min read",
    body: "Summer is the easiest season to eat well. This guide covers what to buy, how to tell it is good and how to keep it that way for a few more days.",
    tags: ["seasonal", "fruit", "storage"],
    seoTitle: "Summer produce guide: what to buy and how to store it",
    seoDescription:
      "A buyer's guide to peak-summer fruit and vegetables, with picking signs and storage rules that keep produce fresh for longer.",
    status: "published",
    visible: true,
    order: 2,
    blocks: [
      {
        type: "paragraph",
        text: "Summer produce is forgiving: most of it is at its best raw or barely cooked. The skill is in choosing well at the shop and then not undoing that with a bad fridge drawer.",
      },
      { type: "heading", level: 2, text: "What is at its peak" },
      {
        type: "list",
        ordered: false,
        items: [
          "Stone fruit — peaches, nectarines, apricots: heavy for their size, fragrant at the stem.",
          "Berries — strawberries, blueberries: dry, bright and never leaking at the base.",
          "Tomatoes — heavy, deep colour, a little give at the shoulder.",
          "Leafy greens and herbs — crisp stems, no yellowing at the leaf edge.",
        ],
      },
      { type: "heading", level: 2, text: "How to store it" },
      {
        type: "paragraph",
        text: "Fruit that ripens after picking — peaches, pears, avocados — belongs on the counter, not the fridge. Anything already ripe goes in the fridge and comes out an hour before eating.",
      },
      {
        type: "image",
        src: "/images/lifestyle/strip-4.jpg",
        alt: "Crates of fresh produce in a store",
        caption: "Produce is graded twice: at the market and again when it is packed.",
      },
      {
        type: "columns",
        items: [
          { title: "Fridge", text: "Berries, leafy greens, cut vegetables, ripe stone fruit in a paper bag." },
          { title: "Counter", text: "Tomatoes, whole melons until cut, unripe stone fruit, bananas." },
        ],
      },
      {
        type: "callout",
        title: "Must Read",
        text: "How to Create a Grocery Shopping List",
        href: "/blogs/create-a-grocery-shopping-list",
        label: "Open checklist",
      },
      { type: "heading", level: 2, text: "Picking signs at a glance" },
      steps([
        { title: "Look", text: "Uniform colour and no soft dark patches. Bruising turns the whole tray within a day." },
        { title: "Smell", text: "Ripe fruit smells like fruit. If there is no scent, it was picked early." },
        { title: "Feel", text: "Heavy for its size, firm skin, a little give only where it should be." },
      ]),
    ],
  },
  {
    id: "b-3",
    slug: "top-10-superfoods",
    title: "Top 10 Superfoods for a Balanced Diet: Boost Your Health",
    excerpt: "Ten everyday ingredients worth adding to your basket this week.",
    category: "Organic Food",
    categoryId: "bc_organic",
    author: "Bessie Cooper",
    authorId: "au_bessie",
    publishedAt: daysAgo(21),
    image: "/images/blog/blog-3.jpg",
    readTime: "6 min read",
    body: "There is no single food that fixes a diet. There are, however, a handful of cheap, widely available ingredients that do a lot of work in a normal week.",
    tags: ["nutrition", "organic", "pantry"],
    seoTitle: "Top 10 everyday superfoods for a balanced diet",
    seoDescription:
      "Ten widely available ingredients — from oats to lentils — that make a normal week of cooking more balanced, plus how to store them.",
    status: "published",
    visible: true,
    order: 3,
    blocks: [
      {
        type: "paragraph",
        text: "Superfood is a marketing word. The honest version: some ingredients give you a lot of fibre, protein or micronutrients for very little money. These ten are on that list, and all of them are in a normal grocery aisle.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Oats — fibre and slow carbohydrates for breakfast.",
          "Lentils — cheap protein that keeps in the pantry for a year.",
          "Leafy greens — iron, folate and volume on the plate.",
          "Eggs — complete protein and the fastest dinner there is.",
          "Yoghurt — protein and live cultures; check the sugar line.",
          "Berries — antioxidants with a low sugar load.",
          "Nuts and seeds — fats that keep you full between meals.",
          "Tomatoes — lycopene, best with a little oil.",
          "Garlic and onion — flavour before salt.",
          "Olive oil — the fat most kitchens should default to.",
        ],
      },
      { type: "heading", level: 2, text: "What 'organic' actually tells you" },
      {
        type: "paragraph",
        text: "Organic is a production standard, not a nutrition claim. It tells you how something was grown and handled, which matters most for produce you eat whole and least for anything you peel.",
      },
      {
        type: "image",
        src: "/images/lifestyle/strip-5.jpg",
        alt: "A basket of fresh produce being packed",
        caption: "Buying whole ingredients beats buying fortified versions of the same thing.",
      },
      {
        type: "callout",
        title: "Must Read",
        text: "Why You Should Consider Going Organic",
        href: "/blogs/going-organic",
        label: "Read the article",
      },
    ],
  },
  {
    id: "b-4",
    slug: "going-organic",
    title: "Benefits of Organic Foods: Why You Should Consider Going Organic",
    excerpt: "What organic certification covers, what it does not, and how to spend the difference wisely.",
    category: "Organic Food",
    categoryId: "bc_organic",
    author: "Marcus Reid",
    authorId: "au_marcus",
    publishedAt: daysAgo(28),
    image: "/images/lifestyle/strip-4.jpg",
    readTime: "6 min read",
    body: "Organic food is a set of farming and handling rules. Understanding what they cover makes it much easier to decide where the premium is worth paying.",
    tags: ["organic", "sourcing", "produce"],
    seoTitle: "Benefits of organic food — and where the premium is worth it",
    seoDescription:
      "What organic certification really covers, which produce benefits most from buying organic, and where conventional is just as good.",
    status: "published",
    visible: true,
    order: 4,
    blocks: [
      {
        type: "paragraph",
        text: "If you buy organic everything, your grocery bill doubles and your diet does not. If you buy organic for the products where the standard actually changes something, the cost is manageable.",
      },
      { type: "heading", level: 2, text: "Where it matters most" },
      {
        type: "list",
        ordered: false,
        items: [
          "Leafy greens and soft fruit — eaten whole, with the skin on.",
          "Dairy and eggs — the standard covers the animal's environment and feed.",
          "Anything you eat every single day: it is easier to justify a routine premium.",
        ],
      },
      {
        type: "quote",
        text: "Organic is a production standard, not a nutrition claim. It tells you how something was grown and handled.",
        by: "Marcus Reid",
      },
      { type: "heading", level: 2, text: "Where it matters less" },
      {
        type: "paragraph",
        text: "For thick-skinned produce such as bananas, avocados and oranges, most of what you do not eat is the part that was sprayed. Buy the better-tasting conventional version and spend the difference elsewhere.",
      },
      steps([
        { title: "Start with one aisle", text: "Switch the produce you eat most often, not the whole shop." },
        { title: "Read the label", text: "Certification bodies publish their standards. A logo without one is decoration." },
        { title: "Buy seasonal", text: "An in-season organic vegetable is often cheaper than an imported conventional one." },
      ]),
    ],
  },
  {
    id: "b-5",
    slug: "whats-in-season",
    title: "What’s in Season: Summer Produce Guide for Fresh Fruits and Vegetables",
    excerpt: "A month-by-month look at what is coming out of the fields and what to cook with it.",
    category: "Fruits & Vegetables",
    categoryId: "bc_produce",
    author: "Jenny Alexander",
    authorId: "au_jenny",
    publishedAt: daysAgo(35),
    image: "/images/lifestyle/strip-1.jpg",
    readTime: "4 min read",
    body: "Buying in season is the single cheapest upgrade you can make to a weekly shop. Here is what to look for as the summer weeks move on.",
    tags: ["seasonal", "summer", "meal planning"],
    seoTitle: "What's in season: a summer produce guide",
    seoDescription:
      "A month-by-month summer produce guide: what is at its peak, what to cook with it and what to skip until later in the season.",
    status: "published",
    visible: true,
    order: 5,
    blocks: [
      {
        type: "paragraph",
        text: "Produce moves in blocks, not weeks. Early summer is leaves and berries; high summer is stone fruit and tomatoes; late summer is corn, melons and the first of the autumn squash.",
      },
      { type: "heading", level: 2, text: "Early summer" },
      {
        type: "list",
        ordered: true,
        items: [
          "Salad leaves and herbs — use them quickly, they do not keep.",
          "Strawberries and cherries — check for dry bases and green stems.",
          "Courgette and beans — small ones are sweeter.",
        ],
      },
      { type: "heading", level: 2, text: "High summer" },
      {
        type: "list",
        ordered: true,
        items: [
          "Tomatoes at their heaviest — buy more than you need and cook the rest down.",
          "Peaches and nectarines — counter-ripened, then chilled.",
          "Sweetcorn — cook it the day you buy it.",
        ],
      },
      {
        type: "image",
        src: "/images/lifestyle/produce-bin.jpg",
        alt: "Produce crates stacked in a market",
        caption: "What arrives in the morning is what goes into the delivery windows that afternoon.",
      },
      {
        type: "callout",
        title: "Must Read",
        text: "Summer Produce Guide: Fresh Fruits and Vegetables",
        href: "/blogs/summer-produce-guide",
        label: "Read the full guide",
      },
    ],
  },
  {
    id: "b-6",
    slug: "bakery-freshness",
    title: "Bakery Products That Keep: How to Store Bread and Bakes",
    excerpt: "Where bread actually belongs, and why the fridge is the wrong answer.",
    category: "Bakery Products",
    categoryId: "bc_bakery",
    author: "Bessie Cooper",
    authorId: "au_bessie",
    publishedAt: daysAgo(42),
    image: "/images/lifestyle/strip-5.jpg",
    readTime: "4 min read",
    body: "Bread stales fastest in the fridge and second fastest on the counter. How you store a loaf decides whether it lasts two days or five.",
    tags: ["bakery", "storage", "bread"],
    seoTitle: "How to store bread and bakery products so they keep",
    seoDescription:
      "Why the fridge stales bread, how to freeze a loaf properly and how long each bakery product actually keeps at home.",
    status: "published",
    visible: true,
    order: 6,
    blocks: [
      {
        type: "paragraph",
        text: "Bread goes stale through two separate processes: it dries out, and its starch recrystallises. The fridge speeds up the second one, which is why a chilled loaf is dry and crumbly by the next day.",
      },
      { type: "heading", level: 2, text: "The short version" },
      {
        type: "list",
        ordered: false,
        items: [
          "Counter, in paper or a cotton bag: 2–3 days for a sourdough or country loaf.",
          "Freezer, sliced, in a sealed bag: 3 months, and it toasts straight from frozen.",
          "Fridge: only for sandwiches you are eating within a day.",
        ],
      },
      {
        type: "columns",
        items: [
          { title: "Crusty loaves", text: "Cut side down on a board, or wrapped in paper. Never plastic — it traps the moisture that softens the crust." },
          { title: "Soft buns and rolls", text: "An airtight bag is fine and keeps them soft for two days." },
        ],
      },
      {
        type: "quote",
        text: "Slice before you freeze. A loaf you have to thaw whole is a loaf you will not use.",
        by: "Bessie Cooper",
      },
    ],
  },
  {
    id: "b-7",
    slug: "pantry-restock-checklist",
    title: "A Pantry Restock Checklist for Busy Households",
    excerpt: "The short list of staples that saves a second trip every single week.",
    category: "Grocery",
    categoryId: "bc_grocery",
    author: "Jenny Alexander",
    authorId: "au_jenny",
    publishedAt: daysAgo(49),
    image: "/images/lifestyle/strip-2.jpg",
    readTime: "3 min read",
    body: "A pantry restock is not a big shop. It is a fixed list of twelve things you replace when they run low, so dinner never depends on a fresh trip.",
    tags: ["pantry", "checklist", "weekly shop"],
    seoTitle: "A pantry restock checklist for busy households",
    seoDescription:
      "Twelve staples worth keeping stocked, a simple 'par level' rule, and how to build a restock that takes minutes instead of an evening.",
    status: "published",
    visible: true,
    order: 7,
    blocks: [
      {
        type: "paragraph",
        text: "The households that shop calmly all have the same habit: a fixed list of staples with a set level, replaced when they drop below it. No planning, no crisis.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Rice, pasta and one noodle",
          "Flour and oats",
          "Cooking oil and one vinegar",
          "Tinned tomatoes and one tin of beans",
          "Salt, pepper and two spices you actually use",
          "Coffee or tea",
          "Long-life milk",
          "Onions, garlic and potatoes",
          "Eggs",
          "Frozen peas",
          "One stock cube or paste",
          "Soap and kitchen towels",
        ],
      },
      {
        type: "callout",
        title: "Must Read",
        text: "How to Create a Grocery Shopping List",
        href: "/blogs/create-a-grocery-shopping-list",
        label: "Build the list",
      },
      {
        type: "paragraph",
        text: "Keep the list in a note that everyone can see. When something crosses the level, it goes on the next order — not into a mental note that gets lost by Thursday.",
      },
    ],
  },
  {
    id: "b-8",
    slug: "same-day-delivery-notes",
    title: "How Same-Day Grocery Delivery Actually Works",
    excerpt: "From the market at 5am to your door at 7pm — the real route of an order.",
    category: "Grocery",
    categoryId: "bc_grocery",
    author: "Bessie Cooper",
    authorId: "au_bessie",
    publishedAt: daysAgo(56),
    image: "/images/lifestyle/produce-bin.jpg",
    readTime: "5 min read",
    body: "Same-day delivery is a promise about timing. Here is the actual sequence behind one order, and where it can slip.",
    tags: ["delivery", "operations", "freshness"],
    seoTitle: "How same-day grocery delivery works, step by step",
    seoDescription:
      "The real sequence behind a same-day grocery order — buying, grading, packing, routing and the delivery window — and where it can slip.",
    status: "published",
    visible: true,
    order: 8,
    blocks: [
      {
        type: "paragraph",
        text: "An order placed at noon is not picked at noon. It is picked in the window that matches its delivery slot, from stock that arrived that morning — which is why the cut-off times matter more than the clock on your confirmation.",
      },
      steps([
        { title: "Morning buy", text: "Produce is bought and graded at the market before the store opens." },
        { title: "Order cut-off", text: "Orders placed before the area cut-off are packed for that day's windows." },
        { title: "Pick and pack", text: "Every line is checked against the order, weighed if it is sold by weight, and packed cold-chain first." },
        { title: "Route", text: "Riders are assigned by area so one drop-off does not sit in a bag for three hours." },
        { title: "Door", text: "You get the window, and the order page shows each status change as it happens." },
      ]),
      {
        type: "paragraph",
        text: "When a line is short, we substitute only what you agreed to. Anything we cannot replace is refunded — the order page and the invoice stay the record.",
      },
      {
        type: "image",
        src: "/images/lifestyle/strip-5.jpg",
        alt: "Fresh produce being packed into a bag",
        caption: "Packing runs cold-chain first: chilled, then frozen, then shelf-stable.",
      },
    ],
  },
];

export const pageSectionsSeed: Row[] = [
  /* ---------------------------------------------------------------- about */
  {
    id: "ps_about_hero",
    page: "about",
    key: "hero",
    type: "hero",
    visible: true,
    order: 1,
    data: {
      badgeValue: "16",
      badgeLabel: "Years Experience",
      image: "/images/lifestyle/countdown-left.jpg",
      eyebrow: "About Us",
      title: "Your Trusted Partner in",
      titleAccent: "Fresh Grocery Delivery",
      text: "We started with one delivery route and a simple idea: the shop should do the work of getting groceries to you, not the other way round. Sixteen years later we still buy directly from growers, pack the same morning and deliver the same day across the city.",
      bullets: [
        { text: "Eco-Friendly and Sustainable Practices" },
        { text: "Fresh and High-Quality Groceries" },
        { text: "Convenient and Reliable Delivery" },
      ],
      signature: "Jenny Alexander",
      signatureName: "Jenny Alexander",
      signatureRole: "Founder",
    },
  },
  {
    id: "ps_about_banner",
    page: "about",
    key: "banner",
    type: "banner",
    visible: true,
    order: 2,
    data: {
      image: "/images/blog/blog-1.jpg",
      rating: "4.8",
      ratingLabel: "Star",
      showRating: true,
    },
  },
  {
    id: "ps_about_pillars",
    page: "about",
    key: "pillars",
    type: "pillars",
    visible: true,
    order: 3,
    data: {
      items: [
        {
          title: "Our Vision",
          icon: "target",
          text: "A city where good food is the easy option. We want every neighbourhood we deliver to to have the same fresh produce, the same prices and the same same-day service — whether it is a household of one or a pantry for forty.",
        },
        {
          title: "Our Mission",
          icon: "eye",
          text: "Buy honestly, pack carefully and charge what the food is worth. That means short supply chains, real delivery windows and a team that answers the phone when something goes wrong.",
        },
      ],
    },
  },
  {
    id: "ps_about_team",
    page: "about",
    key: "team",
    type: "team",
    visible: true,
    order: 4,
    data: {
      eyebrow: "Our Team",
      title: "Meet The Passionate",
      titleAccent: "Team Behind Our Success",
      members: [
        { name: "Jenny Alexander", role: "Founder & CEO", image: "/images/avatars/avatar-3.jpg" },
        { name: "Bessie Cooper", role: "Operations Manager", image: "/images/avatars/avatar-1.jpg" },
        { name: "Jane Cooper", role: "Warehouse Manager", image: "/images/avatars/avatar-4.jpg" },
        { name: "Robert Fox", role: "Inventory Specialist", image: "/images/avatars/avatar-6.jpg" },
      ],
    },
  },

  /* -------------------------------------------------------------- contact */
  {
    id: "ps_contact_media",
    page: "contact",
    key: "media",
    type: "media",
    visible: true,
    order: 1,
    data: {
      image: "/images/lifestyle/countdown-left.jpg",
      note: "Messages reach the store team directly. We reply within one working day — usually much sooner during opening hours.",
    },
  },
  {
    id: "ps_contact_map",
    page: "contact",
    key: "map",
    type: "map",
    visible: true,
    order: 2,
    data: {
      embedUrl: "",
      linkLabel: "Open in Google Maps",
      caption: "",
    },
  },
];
