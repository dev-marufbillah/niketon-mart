"use client";

import Image from "next/image";
import { useState } from "react";
import { categoryPlaceholder } from "@/lib/catalogue/departments";
import { cn } from "@/lib/utils/cn";

/** Decorative thumbnail: the adjacent category name supplies the accessible label. */
export function CategoryImage({ src, size = 36, className }: { src?: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const wanted = src?.trim() || categoryPlaceholder;
  const actual = failed === wanted ? categoryPlaceholder : wanted;
  return (
    <Image
      src={actual}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 object-cover", className)}
      onError={() => { if (actual !== categoryPlaceholder) setFailed(actual); }}
    />
  );
}
