import test from "node:test";
import assert from "node:assert/strict";
import { resources } from "../../src/lib/admin/resources";
import { validateResource, parseFields } from "../../src/lib/admin/parse";
import { sectionSchemas } from "../../src/lib/content/section-schema";

test("hero slide admin rejects invalid image fit, focus and mobile image references", () => {
  const errors = validateResource(resources.hero_slides, {
    imageFit: "stretch",
    imagePosition: "above",
    mobileImage: "data:image/png;base64,not-a-persistent-image",
  }, []);

  assert(errors.some((error) => error.includes("image fit")));
  assert(errors.some((error) => error.includes("image focus")));
  assert(errors.some((error) => error.includes("Images must be an upload")));
});

test("hero autoplay interval is bounded to the documented 3-15 seconds", () => {
  const form = new FormData();
  form.set("slideIntervalSeconds", "16");
  const parsed = parseFields(sectionSchemas.hero.fields, form);

  assert(parsed.errors.some((error) => error.includes("Slide interval (seconds) must be 15 or less")));
});
