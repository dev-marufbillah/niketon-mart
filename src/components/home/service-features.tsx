import Image from "next/image";
import { getServiceFeatures } from "@/lib/repositories/content";
import { getSectionCopy } from "@/lib/repositories/homepage";
import { cn } from "@/lib/utils/cn";

const GREEN = "#1B8057";
const YELLOW = "#F8C519";

function ShippingIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-12" fill="none" aria-hidden="true">
      <path d="M24 6.5 40 14v19.5L24 41 8 33.5V14L24 6.5Z" stroke={GREEN} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M8 14l16 7.5L40 14M24 21.5V41" stroke={GREEN} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M16 10.2 32 18v9" stroke={YELLOW} strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-12" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="38" height="26" rx="6" stroke={GREEN} strokeWidth="2.6" />
      <path d="M5 20h38" stroke={GREEN} strokeWidth="2.6" />
      <rect x="10" y="26" width="15" height="5.5" rx="2.75" fill={YELLOW} />
      <circle cx="35.5" cy="28.8" r="3.4" stroke={GREEN} strokeWidth="2.2" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-12" fill="none" aria-hidden="true">
      <path d="M10 26v-2a14 14 0 0 1 28 0v2" stroke={GREEN} strokeWidth="2.6" strokeLinecap="round" />
      <rect x="6.5" y="24" width="9" height="14" rx="4.5" stroke={GREEN} strokeWidth="2.6" />
      <rect x="32.5" y="24" width="9" height="14" rx="4.5" stroke={GREEN} strokeWidth="2.6" />
      <path d="M37 38v1.5a5 5 0 0 1-5 5h-5" stroke={YELLOW} strokeWidth="3" strokeLinecap="round" />
      <circle cx="25" cy="44.5" r="2.4" fill={YELLOW} />
    </svg>
  );
}

const icons: Record<string, React.ReactNode> = {
  shipping: <ShippingIcon />,
  payment: <PaymentIcon />,
  support: <SupportIcon />,
};

/** Service benefits strip — managed in Admin → Website → Service benefits. */
export async function ServiceFeatures() {
  const items = await getServiceFeatures();
  if (items.length === 0) return null;

  return (
    <section id="services" aria-label="Why shop with us" className="bg-white pb-12 pt-2 sm:pb-14">
      <div className="container-page">
        <ul className="grid gap-6 border-t border-line pt-10 sm:grid-cols-3 sm:gap-4">
          {items.slice(0, 3).map((service) => (
            <li key={service.id} className="flex items-center gap-4">
              <span className="shrink-0">{icons[service.icon] ?? <ShippingIcon />}</span>
              <span>
                <span className="block text-[15px] font-extrabold text-ink-900">{service.title}</span>
                <span className="mt-0.5 block text-[12.5px] text-ink-500">{service.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Lifestyle photo strip — images are editable in the Homepage editor. */
export async function LifestyleStrip() {
  const copy = await getSectionCopy("lifestyle");
  const images = (Array.isArray(copy.images) ? copy.images : []) as { url?: string; alt?: string }[];
  const usable = images.filter((image) => typeof image?.url === "string" && image.url);
  if (usable.length === 0) return null;

  return (
    <section id="lifestyle" aria-label="Fresh groceries in real kitchens" className="bg-white pb-2">
      <ul className="grid grid-cols-3 sm:grid-cols-5">
        {usable.slice(0, 5).map((image, index) => (
          <li
            key={`${image.url}-${index}`}
            className={cn("relative h-[104px] overflow-hidden sm:h-[150px] lg:h-[178px]", index > 2 && "hidden sm:block")}
          >
            <Image
              src={image.url!}
              alt={image.alt ?? ""}
              fill
              sizes="(max-width: 640px) 33vw, 20vw"
              className="object-cover transition-transform duration-700 hover:scale-105"
            />
            <span className="absolute inset-0 bg-brand-900/10" aria-hidden="true" />
          </li>
        ))}
      </ul>
    </section>
  );
}
