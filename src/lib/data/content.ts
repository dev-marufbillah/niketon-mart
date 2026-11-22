import type {
  BlogPost,
  FaqItem,
  ServiceFeature,
  Testimonial,
} from "@/lib/types/domain";

export const testimonials: Testimonial[] = [
  {
    id: "t-1",
    quote:
      "I've tried several grocery delivery services, and this one is by far the best. The website is user-friendly, the selection is vast, and the customer service is outstanding. Highly recommend!",
    name: "Bessie Cooper",
    role: "Housewife",
    rating: 5,
    avatar: "/images/avatars/avatar-3.jpg",
  },
  {
    id: "t-2",
    quote:
      "Same-day slots, beautifully packed produce and a support team that actually answers. Our weekly shop now takes four minutes instead of a Saturday morning.",
    name: "Cameron Williamson",
    role: "Small Business Owner",
    rating: 5,
    avatar: "/images/avatars/avatar-1.jpg",
  },
  {
    id: "t-3",
    quote:
      "The beef arrives boneless and curry-cut exactly how I asked, and the potatoes come peeled. It feels like having a helper in the kitchen before I even start cooking.",
    name: "Jenny Alexander",
    role: "Home cook, Gulshan",
    rating: 5,
    avatar: "/images/avatars/avatar-2.jpg",
  },
  {
    id: "t-4",
    quote:
      "Prices are fair, the fruit is genuinely fresh, and the app remembers what our family orders every week. I have not stepped into a supermarket in months.",
    name: "Brooklyn Simmons",
    role: "Working Parent",
    rating: 5,
    avatar: "/images/avatars/avatar-4.jpg",
  },
  {
    id: "t-5",
    quote:
      "I order rui on Friday and it arrives cleaned, curry-cut and on ice. The fish counter saved my weekend cooking more than once.",
    name: "Devon Lane",
    role: "Home cook, Dhanmondi",
    rating: 5,
    avatar: "/images/avatars/avatar-6.jpg",
  },
];

export const blogPosts: BlogPost[] = [
  {
    id: "b-1",
    slug: "create-a-grocery-shopping-list",
    title: "How to Create a Grocery Shopping List: Stay Organized...",
    excerpt:
      "A simple weekly system that keeps your pantry full and your budget intact.",
    category: "Shopping Tips",
    author: "Jenny Alexander",
    publishedAt: "2024-08-14",
    image: "/images/blog/blog-1.jpg",
    readTime: "5 min read",
  },
  {
    id: "b-2",
    slug: "summer-produce-guide",
    title: "Summer Produce Guide: Fresh Fruits and Vegetables to Enjoy",
    excerpt:
      "What is at its peak right now, how to pick it and how to store it longer.",
    category: "Seasonal Guides",
    author: "Jenny Alexander",
    publishedAt: "2024-08-13",
    image: "/images/blog/blog-2.jpg",
    readTime: "7 min read",
  },
  {
    id: "b-3",
    slug: "top-10-superfoods",
    title: "Top 10 Superfoods for a Balanced Diet: Boost Your Heal...",
    excerpt:
      "Ten everyday ingredients worth adding to your basket this week.",
    category: "Healthy Eating",
    author: "Jenny Alexander",
    publishedAt: "2024-08-12",
    image: "/images/blog/blog-3.jpg",
    readTime: "6 min read",
  },
];

export const faqs: FaqItem[] = [
  {
    id: "f-1",
    question: "Are the products fresh and of high quality?",
    answer:
      "Every order is picked on the morning of delivery and quality-checked twice before it leaves our hub. If anything arrives below standard, we replace it free within 24 hours.",
  },
  {
    id: "f-2",
    question: "What are your delivery hours?",
    answer:
      "Orders are delivered every day between 8:00 am and 10:00 pm in two-hour windows, and you pick the window at checkout. Friday deliveries start at 2:00 pm. Same-day slots close at 4:00 pm.",
  },
  {
    id: "f-3",
    question: "What payment methods do you accept?",
    answer:
      "We accept cash on delivery, card on delivery, bKash and Nagad transfers, and card payments through SSLCommerz once your merchant account is connected. Transfers are checked by our team before dispatch.",
  },
  {
    id: "f-4",
    question: "Do you offer any discounts or promotions?",
    answer:
      "Weekly deals refresh every Monday, and newsletter subscribers get 25% off their first order. Coupons on the deals page stack with free delivery over the threshold.",
  },
  {
    id: "f-5",
    question: "How can I provide feedback about my experience?",
    answer:
      "Rate your order from your account, reply to your delivery email, or call our support line any time — every piece of feedback reaches the team that packs your basket.",
  },
  {
    id: "f-6",
    question: "Can you clean and cut fish or meat before delivery?",
    answer:
      "Yes. Every fish, meat and selected vegetable has its own preparation options on the product page — whole, curry cut, boneless, minced, peeled or chopped — and the extra charge is shown before you add it to the cart. Prepared items cannot be returned unless something was wrong with the order.",
  },
];

export const serviceFeatures: ServiceFeature[] = [
  {
    id: "s-1",
    title: "Free Shipping",
    description: "Free shipping for order above ৳ 50",
    icon: "shipping",
  },
  {
    id: "s-2",
    title: "Flexible Payment",
    description: "Multiple secure payment options",
    icon: "payment",
  },
  {
    id: "s-3",
    title: "24×7 Support",
    description: "We support online all days.",
    icon: "support",
  },
];

export const lifestyleImages = [
  "/images/lifestyle/strip-1.jpg",
  "/images/lifestyle/strip-2.jpg",
  "/images/lifestyle/strip-3.jpg",
  "/images/lifestyle/strip-4.jpg",
  "/images/lifestyle/strip-5.jpg",
];

export const heroBullets = [
  { icon: "shield", label: "Secure Payment" },
  { icon: "truck", label: "Fast Delivery" },
] as const;
