import { getTestimonials } from "@/lib/repositories/content";
import { getSectionCopy } from "@/lib/repositories/homepage";
import { TestimonialsCarousel } from "@/components/home/testimonials-carousel";

/** Testimonials section — quotes are managed in Admin → Website → Testimonials. */
export async function Testimonials() {
  const [items, copy] = await Promise.all([getTestimonials(), getSectionCopy("testimonials")]);
  if (items.length === 0) return null;

  const eyebrow = String(copy.eyebrow || "");
  const title = String(copy.title || "");
  const titleAccent = String(copy.titleAccent || "");

  return (
    <section aria-labelledby="testimonials-title" className="relative bg-white py-14 sm:py-16 lg:py-20">
      <div className="container-page text-center">
        {eyebrow ? <p className="text-sm font-semibold text-ink-500">{eyebrow}</p> : null}
        <h2
          id="testimonials-title"
          className="mx-auto mt-2 max-w-[560px] text-[26px] leading-[1.2] sm:text-[32px] lg:text-[38px]"
        >
          {title} {titleAccent ? <span className="text-brand-600">{titleAccent}</span> : null}
        </h2>
      </div>

      <TestimonialsCarousel
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          role: item.role,
          quote: item.quote,
          rating: Number(item.rating ?? 5),
          avatar: item.avatar,
        }))}
      />
    </section>
  );
}
