"use client";

import { useEffect, useRef, useState } from "react";
import { unlockOrderFragmentAction } from "@/lib/actions/orders";

/** Fragments never go to the server in a GET. Exchange by POST, then clean URL. */
export function OrderFragmentAccess({ number }: { number: string }) {
  const attempted = useRef(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (attempted.current) return;
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    // Existing links from earlier releases used ?t=. They can be exchanged,
    // but that initial legacy GET may already be in a server access log.
    const key = fragment.get("token") || query.get("t") || "";
    if (!key) return;
    attempted.current = true;
    query.delete("t");
    const search = query.toString();
    const clean = window.location.pathname + (search ? `?${search}` : "");
    window.history.replaceState(null, "", clean);
    queueMicrotask(() => setMessage("Verifying your private order link…"));
    const form = new FormData(); form.set("number", number); form.set("key", key);
    void unlockOrderFragmentAction(form).then((result) => {
      // A full replacement prevents the Next router from restoring the old
      // fragment from its cached canonical URL after the cookie is granted.
      if (result.ok) window.location.replace(clean);
      else setMessage("This private link could not be verified. Check the key or contact the store.");
    }).catch(() => setMessage("The private link could not be checked. Please try again."));
  }, [number]);
  return message ? <p role="status" className="container-page py-3 text-sm text-ink-700">{message}</p> : null;
}
