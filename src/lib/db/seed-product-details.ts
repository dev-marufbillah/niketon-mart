import type { Product, ProductAttribute, ProductDetails, ProductOptionGroup } from "@/lib/types/domain";

/**
 * Seed content for the Product Details experience
 * -----------------------------------------------
 *  - `optionsFor`     → variation groups (Weight / Pack) per product
 *  - `detailsFor`     → the Additional Information tab, filled per category and
 *                       only with fields that make sense for that product
 *  - `buildSeedReviews` → real review rows so the rating summary and the admin
 *                       moderation queue start from actual data
 *
 * Everything here is written to the database once and then owned by the admin
 * panel — these are seed defaults, not hard-coded page content.
 */

const priceList = (base: number, factor: number) => Math.round(base * factor * 100) / 100;

const isProduce = (product: Product) =>
  product.categoryId === "fresh-fruits" || product.categoryId === "vegetables";

/** Primary image first, then ambient produce photos so the gallery has depth. */
const galleryFor = (product: Product) =>
  isProduce(product)
    ? [product.image, "/images/lifestyle/produce-bin.jpg", "/images/lifestyle/countdown-left.jpg"]
    : [product.image];

export function optionsFor(product: Product): { options?: ProductOptionGroup[]; images?: string[] } {
  const images = galleryFor(product);
  switch (product.id) {
    case "p-oranges":
      return {
        images,
        options: [
          {
            name: "Weight",
            values: [
              { label: "500 g", price: product.price, isDefault: true, stock: 40 },
              { label: "1 Kg", price: priceList(product.price, 1.9), compareAtPrice: priceList(product.price * 2, 1) },
              { label: "2 Kg", price: priceList(product.price, 3.6), compareAtPrice: priceList(product.price * 4, 1) },
              { label: "5 Kg", price: priceList(product.price, 8.5), compareAtPrice: priceList(product.price * 10, 1) },
            ],
          },
        ],
      };
    case "p-strawberry":
      return {
        images,
        options: [
          {
            name: "Pack",
            values: [
              { label: "250 g", price: priceList(product.price, 0.6), isDefault: true, stock: 24 },
              { label: "500 g", price: product.price, stock: 48 },
              { label: "1 Kg", price: priceList(product.price, 1.9) },
            ],
          },
        ],
      };
    case "p-eggs":
      return {
        images,
        options: [
          {
            name: "Pack size",
            values: [
              { label: "6 pcs", price: priceList(product.price, 0.55), isDefault: true, stock: 30 },
              { label: "12 pcs", price: product.price, stock: 60 },
              { label: "30 pcs", price: priceList(product.price, 2.3) },
            ],
          },
        ],
      };
    case "p-almond-milk":
    case "p-orange-juice":
      return {
        images,
        options: [
          {
            name: "Size",
            values: [
              { label: product.unit, price: product.price, isDefault: true },
              { label: "1 L", price: priceList(product.price, 1.8) },
            ],
          },
        ],
      };
    case "p-tomatoes":
    case "p-green-apple":
      return {
        images,
        options: [
          {
            name: "Weight",
            values: [
              { label: "500 g", price: product.price, isDefault: true },
              { label: "1 Kg", price: priceList(product.price, 1.85) },
              { label: "2 Kg", price: priceList(product.price, 3.5) },
            ],
          },
        ],
      };
    default:
      return { images };
  }
}

const supplierFor = (product: Product) => {
  if (product.categoryId === "fresh-fruits" || product.categoryId === "vegetables") return "GreenGrocer farms";
  if (product.categoryId === "bakery") return "Niketon Bakehouse";
  if (product.categoryId === "beverages") return "Fresh Press Co.";
  if (product.categoryId === "household") return "CleanHome Supply";
  return "Niketon Mart pantry";
};

const originFor = (product: Product) =>
  product.attributes?.find((attribute) => attribute.label.toLowerCase() === "origin")?.value ??
  (product.categoryId === "fresh-fruits" || product.categoryId === "vegetables"
    ? "Local farms, Gazipur"
    : "Imported & packed in Dhaka");

const featuresFor = (product: Product): string[] => {
  const produce = product.categoryId === "fresh-fruits" || product.categoryId === "vegetables";
  if (produce) {
    return [
      "Hand-picked and graded the morning of delivery",
      "No artificial ripening agents",
      "Packed in recyclable trays",
      "Quality checked twice before dispatch",
    ];
  }
  if (product.categoryId === "bakery") {
    return ["Baked fresh daily", "No preservatives", "Soft crumb, sturdy crust", "Delivered in a paper bag"];
  }
  if (product.categoryId === "dairy") {
    return ["Cold chain maintained to your door", "No added colour", "Family pack sizes", "Batch dated for freshness"];
  }
  if (product.categoryId === "beverages") {
    return ["Pressed, never from concentrate", "No added sugar", "Chilled during delivery", "Recyclable bottle"];
  }
  if (product.categoryId === "household") {
    return ["Dermatologically tested", "Ready to use — no dilution", "Recyclable packaging", "Bulk value pack"];
  }
  return ["Small-batch production", "No artificial flavours", "Resealable pack", "Locally packed"];
};

const storageFor = (product: Product): string => {
  if (product.categoryId === "fresh-fruits" || product.categoryId === "vegetables") return "Refrigerate at 2–4 °C and use within 4–5 days.";
  if (product.categoryId === "bakery") return "Store in a cool, dry place. Freeze for up to one month.";
  if (product.categoryId === "dairy") return "Keep refrigerated at 2–6 °C. Do not refreeze.";
  if (product.categoryId === "beverages") return "Keep chilled. Once opened, consume within 3 days.";
  if (product.categoryId === "household") return "Store away from direct sunlight. Keep out of reach of children.";
  return "Store in a cool, dry place away from sunlight. Use within the best-before date.";
};

const usageFor = (product: Product): string => {
  if (product.categoryId === "fresh-fruits" || product.categoryId === "vegetables") {
    return "Rinse under cold water just before eating or cooking. Serve raw, in salads or lightly cooked.";
  }
  if (product.categoryId === "bakery") return "Slice thick, toast lightly and serve with butter or jam.";
  if (product.categoryId === "dairy") return "Ready to eat. Stir well before serving.";
  if (product.categoryId === "household") return "Follow the dosage on the pack. Test on a small area first.";
  return "Ready to use straight from the pack. Refrigerate after opening.";
};

const nutritionFor = (product: Product): ProductAttribute[] | undefined => {
  if (product.categoryId === "fresh-fruits" || product.categoryId === "vegetables") {
    return [
      { label: "Energy", value: "52 kcal / 100 g" },
      { label: "Carbohydrates", value: "13 g" },
      { label: "Fibre", value: "2.4 g" },
      { label: "Vitamin C", value: "58 % daily value" },
    ];
  }
  if (product.categoryId === "bakery") {
    return [
      { label: "Energy", value: "247 kcal / slice" },
      { label: "Carbohydrates", value: "41 g" },
      { label: "Protein", value: "9 g" },
      { label: "Sugar", value: "3.2 g" },
    ];
  }
  if (product.categoryId === "dairy" || product.categoryId === "beverages") {
    return [
      { label: "Energy", value: "61 kcal / 100 ml" },
      { label: "Protein", value: "3.4 g" },
      { label: "Sugar", value: "4.7 g" },
      { label: "Fat", value: "3.1 g" },
    ];
  }
  return undefined;
};

export function detailsFor(product: Product): ProductDetails {
  const specifications: ProductAttribute[] = [
    { label: "Product Type", value: product.categoryLabel },
    { label: "Origin", value: originFor(product) },
    { label: "Supplier", value: supplierFor(product) },
    { label: "SKU", value: product.sku ?? `SKU-${product.slug}` },
    { label: "Barcode", value: `89${String(product.id).replace(/\D/g, "").padStart(10, "0").slice(0, 10)}` },
  ];

  const details: ProductDetails = {
    features: featuresFor(product),
    specifications,
    weight: product.unit,
    storage: storageFor(product),
    usage: usageFor(product),
  };

  if (product.categoryId === "fresh-fruits" || product.categoryId === "vegetables" || product.categoryId === "dairy" || product.categoryId === "bakery") {
    details.ingredients = `${product.name} — 100% ${product.name.toLowerCase().replace(/^fresh |^organic |^farm /, "")}, no additives.`;
  }
  const nutrition = nutritionFor(product);
  if (nutrition) details.nutrition = nutrition;

  return details;
}

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

type SeedReview = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  email: string;
  rating: number;
  title: string;
  body: string;
  status: "approved" | "pending";
  verifiedPurchase: boolean;
  reported: boolean;
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
};

const authors = [
  "Ayesha Rahman",
  "Tanvir Hasan",
  "Nusrat Jahan",
  "Imran Chowdhury",
  "Farhana Akter",
  "Rafiul Islam",
  "Sadia Karim",
  "Mahmudul Hasan",
];

const titles = [
  "Fresh and well packed",
  "Exactly as described",
  "Will order again",
  "Good value for the price",
  "Arrived chilled and fresh",
  "Family favourite",
  "Better than the supermarket",
  "Solid everyday pick",
];

const bodies = [
  "Ordered in the morning and it arrived the same afternoon. Everything looked and smelled fresh — no bruised pieces in the pack.",
  "The quality has been consistent across three orders now. Packaging kept everything intact and the delivery team was careful.",
  "Good value for the portion you get. I compared it with two other stores and this one was noticeably fresher.",
  "Used it the same evening and the taste was excellent. Will keep it on the weekly list.",
  "Delivery was on time and the pack was sealed properly. Nothing was squashed or leaking.",
  "My kids finished it in two days. Easy to recommend if you want something reliable rather than fancy.",
];

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export function buildSeedReviews(products: Product[]): SeedReview[] {
  const reviews: SeedReview[] = [];

  products.forEach((product, productIndex) => {
    const count = 2 + (productIndex % 2); // 2 or 3 reviews per product
    for (let index = 0; index < count; index += 1) {
      const authorIndex = (productIndex * 3 + index) % authors.length;
      // A couple of products score a perfect 5.0 so the "5 star" shop filter has
      // something to find; the rest sit in the realistic 4.x range.
      const allFive = productIndex % 13 === 1;
      const rating = allFive ? 5 : index === 0 ? 5 : index === 1 ? (productIndex % 4 === 0 ? 3 : 4) : 5;
      const title = titles[(productIndex + index) % titles.length];
      const body = bodies[(productIndex * 2 + index) % bodies.length];
      const slug = product.slug.split("-").slice(-1)[0];
      reviews.push({
        id: `rev_${product.id.replace(/^p-/, "")}_${index + 1}`,
        productId: product.id,
        productName: product.name,
        name: authors[authorIndex],
        email: `${authors[authorIndex].toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        rating,
        title,
        body,
        // Most seeded reviews are live; one pending row gives the moderator queue
        // something real to approve on the first visit.
        status: productIndex % 7 === 3 && index === 0 ? "pending" : "approved",
        verifiedPurchase: index !== 2,
        reported: false,
        createdAt: daysAgo(3 + ((productIndex * 4 + index * 6) % 70)),
        updatedAt: daysAgo(3 + ((productIndex * 4 + index * 6) % 70)),
        isDemo: true,
      });
      void slug;
    }
  });

  return reviews;
}

export function ratingFromReviews(
  productId: string,
  reviews: { productId: string; status: string; rating: number }[],
) {
  const approved = reviews.filter((review) => review.productId === productId && review.status === "approved");
  if (approved.length === 0) return null;
  const average = approved.reduce((total, review) => total + review.rating, 0) / approved.length;
  return { rating: Math.round(average * 10) / 10, reviewCount: approved.length };
}
