"use client";

import { campaignDeadline } from "@/lib/content/campaign-deadline";
import { useCountdown } from "@/lib/hooks/use-countdown";

function CountdownUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[30px] font-extrabold tabular-nums leading-none text-ink-900 sm:text-[38px]">
        {value}
      </span>
      <span className="mt-2 text-[11.5px] font-medium text-ink-500 sm:text-xs">{label}</span>
    </div>
  );
}

function Separator() {
  return (
    <span aria-hidden="true" className="pb-5 text-[26px] font-bold leading-none text-ink-800 sm:text-[30px]">
      :
    </span>
  );
}

/** No date means no timer; the deadline is never guessed or renewed. */
export function CampaignCountdown({ endsAt }: { endsAt?: string }) {
  const countdown = useCountdown(campaignDeadline(endsAt));
  if (!countdown) return null;
  if (countdown.ended) return <p role="status" className="mt-7 text-sm font-semibold text-ink-600">This offer has ended.</p>;

  return (
    <div
      className="mt-7 flex items-end justify-center gap-2 sm:gap-4"
      role="timer"
      aria-live="off"
      aria-label="Offer countdown"
    >
      <CountdownUnit value={countdown.days} label="Days" />
      <Separator />
      <CountdownUnit value={countdown.hours} label="Hours" />
      <Separator />
      <CountdownUnit value={countdown.minutes} label="Minutes" />
      <Separator />
      <CountdownUnit value={countdown.seconds} label="Seconds" />
    </div>
  );
}
