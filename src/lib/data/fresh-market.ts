import type { PreparationGroup, Product } from "@/lib/types/domain";

/**
 * Fresh-market seed
 * -----------------
 * Fish, meat, poultry, produce and everyday grocery — the products that make
 * Niketon Mart a fresh market and not just a grocery catalogue.
 *
 * Everything here is seed data: once the database is created the admin panel
 * owns every row. Preparation presets are starting points an admin can apply to
 * a product and then edit; a product's own `preparation` block is always the
 * source of truth for what the shopper is offered and what it costs.
 */

/* ------------------------------------------------------------------ presets */

export type PreparationPresetSeed = {
  id: string;
  name: string;
  /** Which part of the market this preset is meant for. */
  category: "fish" | "meat" | "poultry" | "vegetables" | "general";
  description: string;
  groups: PreparationGroup[];
  visible: boolean;
  order: number;
};

const fishStandard: PreparationGroup[] = [
  {
    id: "cut",
    name: "Cutting",
    type: "single",
    required: true,
    options: [
      { id: "whole", label: "Whole fish", charge: 0, isDefault: true, note: "Cleaned, head on." },
      { id: "curry", label: "Curry cut", charge: 0.5, note: "8–10 pieces for a curry." },
      { id: "steak", label: "Steak cut", charge: 0.75, note: "Thick cross-sections for frying." },
      { id: "pieces", label: "Small pieces", charge: 0.5 },
    ],
  },
  {
    id: "head",
    name: "Head",
    type: "single",
    required: true,
    options: [
      { id: "keep", label: "Head included", charge: 0, isDefault: true },
      { id: "remove", label: "Head removed", charge: 0 },
    ],
  },
  {
    id: "clean",
    name: "Cleaning",
    type: "multiple",
    options: [
      { id: "scales", label: "Remove scales", charge: 0 },
      { id: "gills", label: "Remove gills", charge: 0 },
      { id: "inners", label: "Remove internal parts", charge: 0, isDefault: true },
    ],
  },
];

const smallFish: PreparationGroup[] = [
  {
    id: "clean",
    name: "Cleaning",
    type: "single",
    required: true,
    options: [
      { id: "whole", label: "Whole, cleaned", charge: 0, isDefault: true },
      { id: "gutted", label: "Gutted and washed", charge: 0.25 },
      { id: "headless", label: "Head removed", charge: 0.25 },
    ],
  },
];

const meatStandard: PreparationGroup[] = [
  {
    id: "bone",
    name: "Bone",
    type: "single",
    required: true,
    options: [
      { id: "bone-in", label: "Bone-in", charge: 0, isDefault: true },
      { id: "boneless", label: "Boneless", charge: 1 },
    ],
  },
  {
    id: "cut",
    name: "Cut",
    type: "single",
    required: true,
    options: [
      { id: "curry", label: "Curry cut", charge: 0, isDefault: true },
      { id: "small", label: "Small pieces", charge: 0.5 },
      { id: "medium", label: "Medium pieces", charge: 0.5 },
      { id: "large", label: "Large pieces", charge: 0.5 },
      { id: "minced", label: "Minced", charge: 1 },
    ],
  },
  {
    id: "extra",
    name: "Extras",
    type: "multiple",
    options: [
      { id: "fat", label: "Trim visible fat", charge: 0 },
      { id: "wash", label: "Wash before packing", charge: 0 },
    ],
  },
];

const poultryStandard: PreparationGroup[] = [
  {
    id: "cut",
    name: "Cutting",
    type: "single",
    required: true,
    options: [
      { id: "whole", label: "Whole bird", charge: 0, isDefault: true },
      { id: "curry", label: "Curry cut (8 pieces)", charge: 0.5 },
      { id: "small", label: "Small pieces", charge: 0.75 },
    ],
  },
  {
    id: "clean",
    name: "Preparing",
    type: "multiple",
    options: [
      { id: "skin", label: "Skin removed", charge: 0 },
      { id: "giblets", label: "Keep giblets", charge: 0 },
      { id: "marinade", label: "Add basic marinade", charge: 1 },
    ],
  },
];

const vegetableStandard: PreparationGroup[] = [
  {
    id: "prep",
    name: "Preparation",
    type: "single",
    required: true,
    options: [
      { id: "whole", label: "Whole", charge: 0, isDefault: true },
      { id: "cleaned", label: "Cleaned", charge: 0 },
      { id: "peeled", label: "Peeled", charge: 0.5 },
      { id: "sliced", label: "Sliced", charge: 0.75 },
      { id: "chopped", label: "Chopped", charge: 0.75 },
      { id: "diced", label: "Diced", charge: 0.75 },
    ],
  },
];

export const preparationPresetSeed: PreparationPresetSeed[] = [
  {
    id: "prep_fish_large",
    name: "Large fish — curry or steak cut",
    category: "fish",
    description: "Rui, katla, hilsa and other large fish. Head, scales and cutting are all optional.",
    groups: fishStandard,
    visible: true,
    order: 1,
  },
  {
    id: "prep_fish_small",
    name: "Small fish — cleaned whole",
    category: "fish",
    description: "Mola, puti, kachki and other small fish that are cooked whole.",
    groups: smallFish,
    visible: true,
    order: 2,
  },
  {
    id: "prep_meat",
    name: "Meat — bone, cut and trim",
    category: "meat",
    description: "Beef and mutton. Bone-in or boneless, curry cut or minced.",
    groups: meatStandard,
    visible: true,
    order: 3,
  },
  {
    id: "prep_poultry",
    name: "Poultry — whole or curry cut",
    category: "poultry",
    description: "Chicken and duck, skin on or off, cut the way you cook it.",
    groups: poultryStandard,
    visible: true,
    order: 4,
  },
  {
    id: "prep_vegetables",
    name: "Vegetables — peel, slice, dice",
    category: "vegetables",
    description: "For potatoes, pumpkin, carrots and other vegetables people want ready to cook.",
    groups: vegetableStandard,
    visible: true,
    order: 5,
  },
];

/* ----------------------------------------------------------------- products */

type FreshSeed = Omit<Product, "rating" | "reviewCount" | "availability" | "status" | "visibility" | "keywords" | "type"> & {
  rating?: number;
  reviewCount?: number;
};

const at = (day: number) => new Date(Date.UTC(2026, 8, day, 6, 0, 0)).toISOString();

export const freshMarketProducts: Product[] = [
  /* ------------------------------------------------------------------ fish */
  {
    id: "p-rui-fish",
    slug: "fresh-rui-fish",
    name: "Fresh Rui Fish",
    categoryId: "fish",
    categoryLabel: "Fresh Fish",
    unit: "1 kg",
    price: 12.5,
    compareAtPrice: 14,
    rating: 4.8,
    reviewCount: 42,
    image: "/images/products/rui-fish.jpg",
    imageMode: "cover",
    description:
      "River rui, 1–1.5 kg a piece, landed the same morning and cleaned to order. Curry cut, steak cut or whole — just tell us how you cook it.",
    availability: "in_stock",
    stock: 40,
    sku: "FSH-RUI-KG",
    createdAt: at(1),
    soldCount: 180,
    status: "active",
    visibility: "visible",
    tags: ["fresh", "fish", "cut-to-order"],
    flags: { featured: true, bestSeller: true },
    attributes: [
      { label: "Origin", value: "Padma river, Chandpur" },
      { label: "Freshness", value: "Landed today" },
      { label: "Storage", value: "Ice, cook within 24 hours" },
    ],
    images: ["/images/products/rui-fish.jpg"],
    options: [
      {
        name: "Weight",
        values: [
          { label: "1 kg", price: 12.5, stock: 24, isDefault: true },
          { label: "500 g", price: 6.75, stock: 32 },
        ],
      },
    ],
    selling: { unit: "1 kg", minQuantity: 1, step: 1, estimatedWeight: "1–1.5 kg per fish", variableWeight: true },
    preparation: {
      enabled: true,
      presetId: "prep_fish_large",
      groups: fishStandard,
      allowInstructions: true,
      maxInstructionLength: 160,
      note: "Cleaned and cut after you order, packed on ice.",
    },
  },
  {
    id: "p-hilsa",
    slug: "fresh-hilsa-fish",
    name: "Fresh Hilsa (Ilish)",
    categoryId: "fish",
    categoryLabel: "Fresh Fish",
    unit: "1 kg",
    price: 21,
    rating: 4.9,
    reviewCount: 31,
    image: "/images/products/hilsa.jpg",
    imageMode: "cover",
    description:
      "Padma ilish in season, 800 g – 1.2 kg. Steak cut with the head kept is how most kitchens want it — choose that and we will do it before packing.",
    availability: "in_stock",
    stock: 18,
    sku: "FSH-ILS-KG",
    createdAt: at(2),
    soldCount: 96,
    status: "active",
    visibility: "visible",
    tags: ["seasonal", "premium"],
    flags: { featured: true },
    attributes: [
      { label: "Origin", value: "Padma river" },
      { label: "Season", value: "Peak season" },
    ],
    images: ["/images/products/hilsa.jpg"],
    selling: { unit: "1 kg", minQuantity: 1, step: 1, estimatedWeight: "800 g – 1.2 kg per fish", variableWeight: true },
    preparation: {
      enabled: true,
      presetId: "prep_fish_large",
      groups: fishStandard,
      allowInstructions: true,
      maxInstructionLength: 120,
      note: "Hilsa is delicate — we cut it with a single pass so the pieces stay whole.",
    },
  },
  {
    id: "p-prawns",
    slug: "fresh-prawns",
    name: "Fresh Prawns (Bagda)",
    categoryId: "fish",
    categoryLabel: "Fresh Fish",
    unit: "500 g",
    price: 16,
    compareAtPrice: 18,
    rating: 4.7,
    reviewCount: 58,
    image: "/images/products/prawns.jpg",
    imageMode: "cover",
    description:
      "Firm, sweet bagda prawns from Khulna. Have them deveined and the shells taken off, or take them whole and clean them at home.",
    availability: "in_stock",
    stock: 26,
    sku: "FSH-PRW-500",
    createdAt: at(3),
    soldCount: 210,
    status: "active",
    visibility: "visible",
    flags: { bestSeller: true },
    attributes: [{ label: "Size", value: "16–20 pieces per 500 g" }],
    images: ["/images/products/prawns.jpg"],
    options: [
      {
        name: "Weight",
        values: [
          { label: "500 g", price: 16, stock: 20, isDefault: true },
          { label: "1 kg", price: 30, stock: 12 },
        ],
      },
    ],
    selling: { unit: "500 g", minQuantity: 1, step: 1 },
    preparation: {
      enabled: true,
      groups: [
        {
          id: "clean",
          name: "Cleaning",
          type: "single",
          required: true,
          options: [
            { id: "whole", label: "Whole, uncleaned", charge: 0, isDefault: true },
            { id: "deveined", label: "Deveined, shell on", charge: 1 },
            { id: "peeled", label: "Peeled and deveined", charge: 1.5 },
          ],
        },
      ],
      allowInstructions: true,
      maxInstructionLength: 100,
    },
  },
  {
    id: "p-tilapia",
    slug: "fresh-tilapia",
    name: "Fresh Tilapia",
    categoryId: "fish",
    categoryLabel: "Fresh Fish",
    unit: "1 kg",
    price: 7.5,
    rating: 4.4,
    reviewCount: 24,
    image: "/images/products/tilapia.jpg",
    imageMode: "cover",
    description:
      "Farm-raised tilapia, 500–700 g each. A quick curry cut with the scales off is the most popular choice — it is two taps on the product page.",
    availability: "in_stock",
    stock: 34,
    sku: "FSH-TIL-KG",
    createdAt: at(4),
    soldCount: 74,
    status: "active",
    visibility: "visible",
    attributes: [{ label: "Origin", value: "Mymensingh farms" }],
    images: ["/images/products/tilapia.jpg"],
    selling: { unit: "1 kg", minQuantity: 1, step: 1 },
    preparation: {
      enabled: true,
      presetId: "prep_fish_large",
      groups: fishStandard,
      allowInstructions: true,
    },
  },
  {
    id: "p-mola",
    slug: "fresh-mola-fish",
    name: "Fresh Mola Fish",
    categoryId: "fish",
    categoryLabel: "Fresh Fish",
    unit: "250 g",
    price: 4.2,
    rating: 4.6,
    reviewCount: 19,
    image: "/images/products/mola-fish.jpg",
    imageMode: "cover",
    description:
      "Small, bony and full of flavour. Sold cleaned, because nobody wants to gut a hundred mola at home.",
    availability: "in_stock",
    stock: 22,
    sku: "FSH-MOL-250",
    createdAt: at(5),
    soldCount: 55,
    status: "active",
    visibility: "visible",
    images: ["/images/products/mola-fish.jpg"],
    selling: { unit: "250 g", minQuantity: 1, step: 1 },
    preparation: {
      enabled: true,
      presetId: "prep_fish_small",
      groups: smallFish,
      allowInstructions: false,
    },
  },

  /* ------------------------------------------------------------ meat & poultry */
  {
    id: "p-beef",
    slug: "fresh-beef",
    name: "Fresh Beef",
    categoryId: "meat-poultry",
    categoryLabel: "Meat & Poultry",
    unit: "1 kg",
    price: 13.5,
    compareAtPrice: 15,
    rating: 4.7,
    reviewCount: 66,
    image: "/images/products/beef.jpg",
    imageMode: "cover",
    description:
      "Grass-fed beef from a licensed abattoir, hung and cut the morning of delivery. Bone-in curry cut is the default; boneless and minced are one tap away.",
    availability: "in_stock",
    stock: 30,
    sku: "MET-BEF-KG",
    createdAt: at(6),
    soldCount: 240,
    status: "active",
    visibility: "visible",
    tags: ["halal", "cut-to-order"],
    flags: { featured: true, bestSeller: true },
    attributes: [
      { label: "Type", value: "Grass-fed, halal" },
      { label: "Cut to order", value: "Yes" },
    ],
    images: ["/images/products/beef.jpg"],
    options: [
      {
        name: "Weight",
        values: [
          { label: "1 kg", price: 13.5, stock: 18, isDefault: true },
          { label: "500 g", price: 7, stock: 24 },
          { label: "250 g", price: 3.75, stock: 30 },
        ],
      },
    ],
    selling: { unit: "1 kg", minQuantity: 1, step: 1 },
    preparation: {
      enabled: true,
      presetId: "prep_meat",
      groups: meatStandard,
      allowInstructions: true,
      maxInstructionLength: 160,
      note: "Cut by our butchers after packing is confirmed — nothing is pre-cut.",
    },
  },
  {
    id: "p-mutton",
    slug: "fresh-mutton",
    name: "Fresh Mutton",
    categoryId: "meat-poultry",
    categoryLabel: "Meat & Poultry",
    unit: "1 kg",
    price: 17,
    rating: 4.6,
    reviewCount: 28,
    image: "/images/products/mutton.jpg",
    imageMode: "cover",
    description: "Tender goat meat, 8-month animals. Curry cut with bone for a proper kacchi, or boneless for kebabs.",
    availability: "in_stock",
    stock: 16,
    sku: "MET-MUT-KG",
    createdAt: at(7),
    soldCount: 68,
    status: "active",
    visibility: "visible",
    images: ["/images/products/mutton.jpg"],
    selling: { unit: "1 kg", minQuantity: 1, step: 1 },
    preparation: {
      enabled: true,
      presetId: "prep_meat",
      groups: meatStandard,
      allowInstructions: true,
    },
  },
  {
    id: "p-chicken",
    slug: "fresh-chicken",
    name: "Fresh Chicken (Broiler)",
    categoryId: "meat-poultry",
    categoryLabel: "Meat & Poultry",
    unit: "1 kg",
    price: 5.2,
    rating: 4.8,
    reviewCount: 112,
    image: "/images/products/chicken.jpg",
    imageMode: "cover",
    description:
      "Whole or curry cut, skin on or off. Sold by weight after cleaning — the weight on the label is what you pay for.",
    availability: "in_stock",
    stock: 55,
    sku: "MET-CHK-KG",
    createdAt: at(8),
    soldCount: 480,
    status: "active",
    visibility: "visible",
    tags: ["daily"],
    flags: { bestSeller: true, dealOfTheDay: true },
    attributes: [{ label: "Weight", value: "1.2–1.4 kg per bird" }],
    images: ["/images/products/chicken.jpg"],
    options: [
      {
        name: "Weight",
        values: [
          { label: "1 kg", price: 5.2, stock: 32, isDefault: true },
          { label: "500 g", price: 2.7, stock: 40 },
        ],
      },
    ],
    selling: { unit: "1 kg", minQuantity: 1, step: 1, estimatedWeight: "1.2–1.4 kg per bird", variableWeight: true },
    preparation: {
      enabled: true,
      presetId: "prep_poultry",
      groups: poultryStandard,
      allowInstructions: true,
      maxInstructionLength: 140,
    },
  },
  {
    id: "p-duck",
    slug: "fresh-duck",
    name: "Fresh Duck (Deshi)",
    categoryId: "meat-poultry",
    categoryLabel: "Meat & Poultry",
    unit: "1 kg",
    price: 9.8,
    rating: 4.5,
    reviewCount: 14,
    image: "/images/products/duck.jpg",
    imageMode: "cover",
    description: "Free-range deshi duck, richer and darker than chicken. Curry cut is standard; ask for small pieces for a rezala.",
    availability: "in_stock",
    stock: 12,
    sku: "MET-DUK-KG",
    createdAt: at(9),
    soldCount: 32,
    status: "active",
    visibility: "visible",
    images: ["/images/products/duck.jpg"],
    selling: { unit: "1 kg", minQuantity: 1, step: 1 },
    preparation: {
      enabled: true,
      presetId: "prep_poultry",
      groups: poultryStandard,
      allowInstructions: true,
    },
  },

  /* ------------------------------------------------------------ vegetables */
  {
    id: "p-potato",
    slug: "fresh-potato",
    name: "Fresh Potato",
    categoryId: "vegetables",
    categoryLabel: "Fresh Vegetables",
    unit: "1 kg",
    price: 1.2,
    rating: 4.6,
    reviewCount: 87,
    image: "/images/products/potato.jpg",
    imageMode: "cover",
    description:
      "Country potatoes, firm and low-sugar. Order them whole, or have them peeled and diced so dinner starts ten minutes earlier.",
    availability: "in_stock",
    stock: 120,
    sku: "VEG-POT-KG",
    createdAt: at(10),
    soldCount: 610,
    status: "active",
    visibility: "visible",
    flags: { bestSeller: true },
    attributes: [{ label: "Variety", value: "Diamond" }],
    images: ["/images/products/potato.jpg"],
    options: [
      {
        name: "Weight",
        values: [
          { label: "1 kg", price: 1.2, stock: 80, isDefault: true },
          { label: "500 g", price: 0.65, stock: 90 },
        ],
      },
    ],
    selling: { unit: "1 kg", minQuantity: 1, step: 1 },
    preparation: {
      enabled: true,
      presetId: "prep_vegetables",
      groups: vegetableStandard,
      allowInstructions: true,
      maxInstructionLength: 100,
    },
  },
  {
    id: "p-green-chili",
    slug: "fresh-green-chili",
    name: "Fresh Green Chili",
    categoryId: "vegetables",
    categoryLabel: "Fresh Vegetables",
    unit: "250 g",
    price: 1.1,
    rating: 4.5,
    reviewCount: 33,
    image: "/images/products/green-chili.jpg",
    imageMode: "cover",
    description: "Small, hot local chilies. We can chop them — with or without the seeds — before packing.",
    availability: "in_stock",
    stock: 60,
    sku: "VEG-CHL-250",
    createdAt: at(11),
    soldCount: 220,
    status: "active",
    visibility: "visible",
    images: ["/images/products/green-chili.jpg"],
    selling: { unit: "250 g", minQuantity: 1, step: 1 },
    preparation: {
      enabled: true,
      groups: [
        {
          id: "prep",
          name: "Preparation",
          type: "single",
          required: true,
          options: [
            { id: "whole", label: "Whole", charge: 0, isDefault: true },
            { id: "chopped", label: "Chopped", charge: 0.3 },
            { id: "slit", label: "Slit", charge: 0.3 },
          ],
        },
      ],
      allowInstructions: true,
      maxInstructionLength: 80,
    },
  },

  /* ---------------------------------------------------------------- grocery */
  {
    id: "p-chinigura-rice",
    slug: "chinigura-aromatic-rice",
    name: "Chinigura Aromatic Rice",
    categoryId: "daily-grocery",
    categoryLabel: "Daily Grocery & Essentials",
    unit: "1 kg",
    price: 2.6,
    rating: 4.7,
    reviewCount: 41,
    image: "/images/products/chinigura-rice.jpg",
    imageMode: "cover",
    description: "Small-grain aromatic rice for polao and biryani. Cleaned and stone-free.",
    availability: "in_stock",
    stock: 90,
    sku: "GRO-RIC-1KG",
    createdAt: at(12),
    soldCount: 190,
    status: "active",
    visibility: "visible",
    attributes: [{ label: "Pack", value: "Food-grade sealed bag" }],
    images: ["/images/products/chinigura-rice.jpg"],
    options: [
      {
        name: "Pack size",
        values: [
          { label: "1 kg", price: 2.6, stock: 60, isDefault: true },
          { label: "5 kg", price: 12.2, stock: 30 },
        ],
      },
    ],
    selling: { unit: "1 kg", minQuantity: 1, step: 1 },
  },
  {
    id: "p-masoor-dal",
    slug: "masoor-dal",
    name: "Masoor Dal (Red Lentil)",
    categoryId: "daily-grocery",
    categoryLabel: "Daily Grocery & Essentials",
    unit: "1 kg",
    price: 1.9,
    rating: 4.5,
    reviewCount: 27,
    image: "/images/products/masoor-dal.jpg",
    imageMode: "cover",
    description: "Sorted red lentils, washed and ready to cook. Sold in 500 g and 1 kg packs.",
    availability: "in_stock",
    stock: 75,
    sku: "GRO-DAL-1KG",
    createdAt: at(13),
    soldCount: 160,
    status: "active",
    visibility: "visible",
    images: ["/images/products/masoor-dal.jpg"],
    selling: { unit: "1 kg", minQuantity: 1, step: 1 },
  },
  {
    id: "p-soybean-oil",
    slug: "soybean-oil",
    name: "Soybean Cooking Oil",
    categoryId: "daily-grocery",
    categoryLabel: "Daily Grocery & Essentials",
    unit: "1 L",
    price: 2.4,
    rating: 4.3,
    reviewCount: 22,
    image: "/images/products/soybean-oil.jpg",
    imageMode: "contain",
    description: "Fortified soybean oil in a sealed 1-litre bottle.",
    availability: "in_stock",
    stock: 64,
    sku: "GRO-OIL-1L",
    createdAt: at(14),
    soldCount: 140,
    status: "active",
    visibility: "visible",
    images: ["/images/products/soybean-oil.jpg"],
    selling: { unit: "1 L", minQuantity: 1, step: 1 },
  },

  /* ------------------------------------------------------------------ fruit */
  {
    id: "p-mango",
    slug: "fresh-mango",
    name: "Himsagar Mango",
    categoryId: "fresh-fruits",
    categoryLabel: "Fresh Fruits",
    unit: "1 kg",
    price: 4.8,
    compareAtPrice: 5.6,
    rating: 4.9,
    reviewCount: 74,
    image: "/images/products/mango.jpg",
    imageMode: "cover",
    description: "Himsagar from Rajshahi, ripened naturally. Sold by weight, roughly 3–4 fruits a kilo.",
    availability: "in_stock",
    stock: 48,
    sku: "FRU-MNG-KG",
    createdAt: at(15),
    soldCount: 320,
    status: "active",
    visibility: "visible",
    tags: ["seasonal"],
    flags: { featured: true, weeklySpecial: true },
    attributes: [{ label: "Origin", value: "Chapai Nawabganj" }],
    images: ["/images/products/mango.jpg"],
    selling: { unit: "1 kg", minQuantity: 1, step: 1, estimatedWeight: "3–4 fruits per kg", variableWeight: true },
  },
];

/** Kept for the type import above so the seed stays explicit about its shape. */
export type FreshSeedShape = FreshSeed;
