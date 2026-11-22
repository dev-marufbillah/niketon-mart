import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Lightbulb, Quote } from "lucide-react";
import type { PostBlock } from "@/lib/repositories/content";
import { cn } from "@/lib/utils/cn";

/**
 * Article blocks
 * --------------
 * The blog body is a list of typed blocks (paragraph, heading, list, image, quote,
 * callout, columns, steps) edited with the block editor in the admin. Rendering
 * them here keeps the article accessible (real h2/h3, figure/caption, ul/ol) and
 * means a new block type only needs an entry in this switch + the editor.
 *
 * `slugify` is shared with the table of contents so anchors always match.
 */

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

/** Table of contents — h2 blocks only, in document order, with unique anchors. */
export function tableOfContents(blocks: PostBlock[]): { id: string; text: string }[] {
  const seen = new Map<string, number>();
  const items: { id: string; text: string }[] = [];
  for (const block of blocks) {
    if (block.type !== "heading" || Number(block.level) !== 2 || !block.text) continue;
    const base = slugifyHeading(block.text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    items.push({ id: count === 0 ? base : `${base}-${count + 1}`, text: block.text });
  }
  return items;
}

export function PostBlocks({ blocks }: { blocks: PostBlock[] }) {
  const seen = new Map<string, number>();

  const anchor = (text: string) => {
    const base = slugifyHeading(text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading": {
            const id = anchor(block.text);
            return Number(block.level) === 3 ? (
              <h3 key={index} id={id} className="pt-1 text-[17px] font-extrabold leading-snug text-ink-900">
                {block.text}
              </h3>
            ) : (
              <h2 key={index} id={id} className="pt-2 text-[21px] font-extrabold leading-snug text-ink-900 sm:text-[23px]">
                {block.text}
              </h2>
            );
          }
          case "paragraph":
            return (
              <p key={index} className="text-[14.5px] leading-[1.9] text-ink-600">
                {block.text}
              </p>
            );
          case "list":
            return block.ordered ? (
              <ol key={index} className="ml-4 list-decimal space-y-2 text-[14.5px] leading-[1.85] text-ink-600">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="pl-1">
                    {item}
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={index} className="space-y-2 text-[14.5px] leading-[1.85] text-ink-600">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-2">
                    <CheckCircle2 size={15} className="mt-1 shrink-0 text-brand-600" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "image":
            return (
              <figure key={index} className="overflow-hidden rounded-xl bg-surface">
                {block.src ? (
                  <div className="relative aspect-[16/9]">
                    <Image
                      src={block.src}
                      alt={block.alt || ""}
                      fill
                      sizes="(max-width: 1024px) 100vw, 740px"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                {block.caption ? (
                  <figcaption className="px-3 py-2 text-[11.5px] text-ink-400">{block.caption}</figcaption>
                ) : null}
              </figure>
            );
          case "quote":
            return (
              <blockquote
                key={index}
                className="relative rounded-xl bg-brand-600 px-5 py-5 text-white sm:px-6 sm:py-6"
              >
                <Quote size={22} className="text-accent-400" aria-hidden="true" />
                <p className="mt-2 text-[14.5px] font-semibold leading-relaxed sm:text-[15.5px]">{block.text}</p>
                {block.by ? <footer className="mt-2 text-[11.5px] text-white/70">— {block.by}</footer> : null}
              </blockquote>
            );
          case "callout":
            return (
              <aside
                key={index}
                className="rounded-xl bg-brand-600 p-4 text-white sm:flex sm:items-start sm:gap-3 sm:p-5"
              >
                <Lightbulb size={18} className="shrink-0 text-accent-400" aria-hidden="true" />
                <div className="mt-1.5 sm:mt-0">
                  {block.title ? <p className="text-[14px] font-extrabold">{block.title}</p> : null}
                  {block.text ? (
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/85">{block.text}</p>
                  ) : null}
                  {block.href ? (
                    <Link
                      href={block.href}
                      className="mt-2.5 inline-flex h-8 items-center rounded-full bg-accent-500 px-3.5 text-[11.5px] font-bold text-brand-900 hover:bg-accent-400"
                    >
                      {block.label || "Learn more"}
                    </Link>
                  ) : null}
                </div>
              </aside>
            );
          case "columns":
            return (
              <div key={index} className="grid gap-3 sm:grid-cols-2">
                {block.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="rounded-xl bg-surface p-4">
                    <p className="text-[13.5px] font-extrabold text-ink-900">{item.title}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{item.text}</p>
                  </div>
                ))}
              </div>
            );
          case "steps":
            return (
              <ol key={index} className="space-y-3">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-3">
                    <span
                      className={cn(
                        "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-black text-white",
                      )}
                    >
                      {itemIndex + 1}
                    </span>
                    <div>
                      <p className="text-[13.5px] font-extrabold text-ink-900">{item.title}</p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
