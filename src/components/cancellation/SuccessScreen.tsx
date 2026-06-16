type SuccessScreenProps = {
  cancelledCount: number;
  monthlySavings: number;
  onDone: () => void;
};

export function SuccessScreen({ cancelledCount, monthlySavings, onDone }: SuccessScreenProps) {
  return (
    <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-[#DBE4EE]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-black text-emerald-700">
        ✓
      </div>
      <h2 className="mt-5 text-2xl font-extrabold tracking-tight">Ferdig</h2>
      <p className="mt-3 text-sm leading-6 text-[#5F6F82]">
        {cancelledCount} abonnementer er markert som avsluttet. Du har frigjort{" "}
        {monthlySavings} kr per måned i potensiell besparelse.
      </p>
      <button
        className="mt-7 rounded-xl bg-[#0D1B2A] px-6 py-3 text-sm font-bold text-white hover:bg-[#15283c]"
        onClick={onDone}
        type="button"
      >
        Til oversikten
      </button>
    </div>
  );
}
