"use client";

import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { FieldInput, type PickerMedia } from "@/components/admin/field-input";

/**
 * Block editor for article bodies.
 *
 * The article body is an ordered list of typed blocks (paragraph, heading, image,
 * list, quote, callout, columns, steps). Each block type gets its own small form,
 * the order is drag-free (arrows), and the value saved to the database is the
 * same array the storefront renders. No HTML is stored or injected.
 */

export type EditorBlock = {
  type: string;
  [key: string]: unknown;
};

const BLOCK_LABELS: Record<string, string> = {
  paragraph: "Paragraph",
  heading: "Heading",
  image: "Image",
  list: "List",
  quote: "Quote",
  callout: "Callout",
  columns: "Two-column cards",
  steps: "Step cards",
};

const NEW_BLOCK: Record<string, EditorBlock> = {
  paragraph: { type: "paragraph", text: "" },
  heading: { type: "heading", level: 2, text: "" },
  image: { type: "image", src: "", alt: "", caption: "" },
  list: { type: "list", ordered: false, items: [""] },
  quote: { type: "quote", text: "", by: "" },
  callout: { type: "callout", title: "Must Read", text: "", href: "", label: "" },
  columns: { type: "columns", items: [{ title: "", text: "" }, { title: "", text: "" }] },
  steps: { type: "steps", items: [{ title: "", text: "" }, { title: "", text: "" }, { title: "", text: "" }] },
};

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500";
const tinyLabel = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-400";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function pairs(value: unknown): { title: string; text: string }[] {
  return Array.isArray(value)
    ? (value as { title?: string; text?: string }[]).map((item) => ({
        title: text(item?.title),
        text: text(item?.text),
      }))
    : [];
}

export function BlockEditor({
  blocks,
  blockTypes,
  media = [],
  onChange,
}: {
  blocks: EditorBlock[];
  blockTypes: string[];
  media?: PickerMedia[];
  onChange: (blocks: EditorBlock[]) => void;
}) {
  const update = (index: number, patch: Record<string, unknown>) =>
    onChange(blocks.map((block, position) => (position === index ? { ...block, ...patch } : block)));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = blocks.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index: number) => onChange(blocks.filter((_, position) => position !== index));

  const duplicate = (index: number) =>
    onChange([...blocks.slice(0, index + 1), { ...blocks[index] }, ...blocks.slice(index + 1)]);

  const add = (type: string) =>
    onChange([...blocks, { ...(NEW_BLOCK[type] ?? { type }) }]);

  return (
    <div className="space-y-3">
      {blocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center text-[12px] text-ink-500">
          No content yet. Add a paragraph to start the article.
        </p>
      ) : null}

      <ol className="space-y-2.5">
        {blocks.map((block, index) => (
          <li key={index} className="rounded-xl border border-line bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-line bg-surface/60 px-3 py-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-ink-600">
                <span className="inline-flex size-4.5 items-center justify-center rounded bg-brand-600 text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                {BLOCK_LABELS[block.type] ?? block.type}
              </span>
              <span className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${BLOCK_LABELS[block.type] ?? block.type} up`}
                  className="rounded p-1 text-ink-400 hover:bg-white hover:text-ink-800 disabled:opacity-30"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === blocks.length - 1}
                  aria-label={`Move ${BLOCK_LABELS[block.type] ?? block.type} down`}
                  className="rounded p-1 text-ink-400 hover:bg-white hover:text-ink-800 disabled:opacity-30"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => duplicate(index)}
                  aria-label={`Duplicate ${BLOCK_LABELS[block.type] ?? block.type}`}
                  className="rounded p-1 text-ink-400 hover:bg-white hover:text-ink-800"
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${BLOCK_LABELS[block.type] ?? block.type}`}
                  className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>

            <div className="space-y-2.5 p-3">
              {block.type === "paragraph" ? (
                <textarea
                  rows={4}
                  value={text(block.text)}
                  placeholder="Write a paragraph…"
                  onChange={(event) => update(index, { text: event.target.value })}
                  className={`${inputClass} resize-y leading-relaxed`}
                />
              ) : null}

              {block.type === "heading" ? (
                <div className="flex gap-2">
                  <select
                    value={String(block.level ?? 2)}
                    onChange={(event) => update(index, { level: Number(event.target.value) })}
                    className={`${inputClass} max-w-[110px]`}
                    aria-label="Heading level"
                  >
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                  </select>
                  <input
                    value={text(block.text)}
                    placeholder="Heading text"
                    onChange={(event) => update(index, { text: event.target.value })}
                    className={inputClass}
                  />
                </div>
              ) : null}

              {block.type === "image" ? (
                <>
                  <FieldInput
                    field={{ name: `block-${index}-image`, label: "Image", type: "image", span: 1 }}
                    value={block.src}
                    onChange={(value) => update(index, { src: String(value ?? "") })}
                    media={media}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={text(block.alt)}
                      placeholder="Alt text (for screen readers)"
                      onChange={(event) => update(index, { alt: event.target.value })}
                      className={inputClass}
                    />
                    <input
                      value={text(block.caption)}
                      placeholder="Caption (optional)"
                      onChange={(event) => update(index, { caption: event.target.value })}
                      className={inputClass}
                    />
                  </div>
                </>
              ) : null}

              {block.type === "list" ? (
                <>
                  <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-600">
                    <input
                      type="checkbox"
                      checked={Boolean(block.ordered)}
                      onChange={(event) => update(index, { ordered: event.target.checked })}
                      className="size-3.5 accent-brand-600"
                    />
                    Numbered list
                  </label>
                  <textarea
                    rows={4}
                    value={(Array.isArray(block.items) ? (block.items as string[]) : []).join("\n")}
                    placeholder="One item per line"
                    onChange={(event) =>
                      update(index, { items: event.target.value.split("\n").filter((line, i, all) => line.trim() || i < all.length - 1) })
                    }
                    className={`${inputClass} resize-y`}
                  />
                </>
              ) : null}

              {block.type === "quote" ? (
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                  <textarea
                    rows={2}
                    value={text(block.text)}
                    placeholder="Quote"
                    onChange={(event) => update(index, { text: event.target.value })}
                    className={`${inputClass} resize-y`}
                  />
                  <input
                    value={text(block.by)}
                    placeholder="Attributed to"
                    onChange={(event) => update(index, { by: event.target.value })}
                    className={inputClass}
                  />
                </div>
              ) : null}

              {block.type === "callout" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={text(block.title)}
                    placeholder="Label, e.g. Must Read"
                    onChange={(event) => update(index, { title: event.target.value })}
                    className={inputClass}
                  />
                  <input
                    value={text(block.text)}
                    placeholder="Title of the piece you are linking"
                    onChange={(event) => update(index, { text: event.target.value })}
                    className={inputClass}
                  />
                  <input
                    value={text(block.href)}
                    placeholder="/blogs/some-article"
                    onChange={(event) => update(index, { href: event.target.value })}
                    className={inputClass}
                  />
                  <input
                    value={text(block.label)}
                    placeholder="Button label"
                    onChange={(event) => update(index, { label: event.target.value })}
                    className={inputClass}
                  />
                </div>
              ) : null}

              {block.type === "columns" || block.type === "steps" ? (
                <div className="space-y-2">
                  {pairs(block.items).map((item, itemIndex) => (
                    <div key={itemIndex} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                      <span>
                        <span className={tinyLabel}>{block.type === "steps" ? `Step ${itemIndex + 1}` : `Card ${itemIndex + 1}`} title</span>
                        <input
                          value={item.title}
                          onChange={(event) => {
                            const next = pairs(block.items);
                            next[itemIndex] = { ...next[itemIndex], title: event.target.value };
                            update(index, { items: next });
                          }}
                          className={inputClass}
                        />
                      </span>
                      <span>
                        <span className={tinyLabel}>Text</span>
                        <input
                          value={item.text}
                          onChange={(event) => {
                            const next = pairs(block.items);
                            next[itemIndex] = { ...next[itemIndex], text: event.target.value };
                            update(index, { items: next });
                          }}
                          className={inputClass}
                        />
                      </span>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => update(index, { items: [...pairs(block.items), { title: "", text: "" }] })}
                      className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-[11.5px] font-semibold text-ink-700 ring-1 ring-line hover:text-brand-700"
                    >
                      <Plus size={11} /> Add item
                    </button>
                    {pairs(block.items).length > 1 ? (
                      <button
                        type="button"
                        onClick={() => update(index, { items: pairs(block.items).slice(0, -1) })}
                        className="rounded-full px-3 py-1 text-[11.5px] font-semibold text-ink-400 hover:text-red-600"
                      >
                        Remove last
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-line bg-surface/50 p-2.5">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">Add block</span>
        {blockTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => add(type)}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink-700 ring-1 ring-line hover:text-brand-700"
          >
            <Plus size={11} /> {BLOCK_LABELS[type] ?? type}
          </button>
        ))}
      </div>
    </div>
  );
}
