import type { Product } from "@/lib/types/domain";

/**
 * Explicit storefront DTO. Database rows may acquire internal supplier, cost or
 * margin fields later: never pass the raw row into a client/RSC payload.
 * Nested business objects are projected too, so unknown fields cannot hitch a
 * ride inside preparation options, variants or product details.
 */
export function toPublicProduct(product: Product): Product {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    categoryLabel: product.categoryLabel,
    unit: product.unit,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    rating: product.rating,
    reviewCount: product.reviewCount,
    image: product.image,
    imageMode: product.imageMode,
    description: product.description,
    availability: product.availability,
    tags: product.tags,
    flags: product.flags && {
      featured: product.flags.featured,
      bestSeller: product.flags.bestSeller,
      dealOfTheDay: product.flags.dealOfTheDay,
      weeklySpecial: product.flags.weeklySpecial,
    },
    brandId: product.brandId,
    productTypeId: product.productTypeId,
    stock: product.stock,
    sku: product.sku,
    createdAt: product.createdAt,
    soldCount: product.soldCount,
    status: product.status,
    visibility: product.visibility,
    attributes: product.attributes?.map(({ label, value }) => ({ label, value })),
    images: product.images,
    options: product.options?.map((group) => ({
      name: group.name,
      values: group.values.map(({ label, grams, price, compareAtPrice, stock, image, isDefault }) => ({
        label, grams, price, compareAtPrice, stock, image, isDefault,
      })),
    })),
    details: product.details && {
      features: product.details.features,
      specifications: product.details.specifications?.map(({ label, value }) => ({ label, value })),
      weight: product.details.weight,
      dimensions: product.details.dimensions,
      ingredients: product.details.ingredients,
      nutrition: product.details.nutrition?.map(({ label, value }) => ({ label, value })),
      storage: product.details.storage,
      usage: product.details.usage,
    },
    preparation: product.preparation && {
      enabled: product.preparation.enabled,
      presetId: product.preparation.presetId,
      allowInstructions: product.preparation.allowInstructions,
      maxInstructionLength: product.preparation.maxInstructionLength,
      note: product.preparation.note,
      groups: product.preparation.groups.map((group) => ({
        id: group.id,
        name: group.name,
        type: group.type,
        required: group.required,
        options: group.options.map(({ id, label, charge, isDefault, note }) => ({ id, label, charge, isDefault, note })),
      })),
    },
    selling: product.selling && {
      unit: product.selling.unit,
      minQuantity: product.selling.minQuantity,
      step: product.selling.step,
      estimatedWeight: product.selling.estimatedWeight,
      variableWeight: product.selling.variableWeight,
      unitGrams: product.selling.unitGrams,
    },
  };
}
