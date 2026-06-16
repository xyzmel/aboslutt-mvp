import type { Subscription } from "@/types/subscription";

type ConfirmCancellationProps = {
  selectedSubscriptions: Subscription[];
  monthlySavings: number;
  onBack: () => void;
  onConfirm: () => void;
};

export function ConfirmCancellation({
  selectedSubscriptions,
  monthlySavings,
  onBack,
  onConfirm,
}: ConfirmCancellationProps) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#DBE4EE]">
      <p className="text-sm font-bold uppercase tracking-wide text-[#C8102E]">Bekreft valg</p>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Avslutt abonnementer?</h2>
      <p className="mt-3 text-sm leading-6 text-[#5F6F82]">
        Vi markerer valgte abonnementer som avsluttet i oversikten din. Aboslutt
        sender foreløpig ingen ekte oppsigelser til eksterne leverandører.
      </p>

      <div className="mt-5 rounded-xl bg-[#F7F9FC] p-4">
        <p className="text-sm font-bold">{selectedSubscriptions.length} valgt</p>
        <p className="mt-1 text-sm text-[#5F6F82]">
          Potensiell besparelse: {monthlySavings} kr/mnd
        </p>
        <ul className="mt-4 space-y-2 text-sm text-[#0D1B2A]">
          {selectedSubscriptions.map((subscription) => (
            <li className="flex justify-between gap-3" key={subscription.id}>
              <span>{subscription.name}</span>
              <span className="font-semibold">{subscription.monthlyCost} kr</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          className="rounded-xl border border-[#DBE4EE] px-5 py-3 text-sm font-bold text-[#0D1B2A] hover:bg-[#F0F4F8]"
          onClick={onBack}
          type="button"
        >
          Gå tilbake
        </button>
        <button
          className="rounded-xl bg-[#C8102E] px-5 py-3 text-sm font-bold text-white hover:bg-[#a90d27]"
          onClick={onConfirm}
          type="button"
        >
          Bekreft avslutning
        </button>
      </div>
    </div>
  );
}
