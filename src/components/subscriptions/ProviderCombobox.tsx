"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { getProviderInitials } from "@/lib/subscription-provider-catalog.mjs";
import type { BillingInterval, SubscriptionCategory } from "@/types/subscription";

export type ProviderOption = {
  id: string;
  name: string;
  slug: string;
  category: string;
  suggestedCategory: SubscriptionCategory;
  logoPath: string | null;
  defaultBillingInterval: BillingInterval | null;
};

export function ProviderCombobox({
  value,
  selectedProviderId,
  error,
  onChange,
  onSelect,
}: {
  value: string;
  selectedProviderId?: string | null;
  error?: string;
  onChange: (value: string) => void;
  onSelect: (provider: ProviderOption | null) => void;
}) {
  const inputId = useId();
  const listId = `${inputId}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<ProviderOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [failedLogos, setFailedLogos] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/subscription-providers?q=${encodeURIComponent(value)}&limit=8`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => ({}))) as { results?: ProviderOption[] };
        setResults(response.ok && Array.isArray(result.results) ? result.results : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const showCustom = Boolean(value.trim()) && !results.some((provider) => provider.name.toLowerCase() === value.trim().toLowerCase());
  const optionCount = results.length + (showCustom ? 1 : 0);

  function chooseProvider(provider: ProviderOption | null) {
    if (provider) onChange(provider.name);
    onSelect(provider);
    setIsOpen(false);
    setActiveIndex(-1);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, optionCount - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && isOpen && activeIndex >= 0) {
      event.preventDefault();
      chooseProvider(activeIndex < results.length ? results[activeIndex] : null);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="relative md:col-span-1" ref={containerRef}>
      <label className="text-sm font-semibold text-[#4A5568]" htmlFor={inputId}>
        Leverandør
      </label>
      <input
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={isOpen}
        aria-invalid={Boolean(error)}
        autoComplete="off"
        className={`mt-2 w-full rounded-xl border px-3 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#0D1B2A] ${
          error ? "border-[#C8102E] bg-[#FFF8F9]" : selectedProviderId ? "border-emerald-300 bg-emerald-50/40" : "border-[#DBE4EE]"
        }`}
        id={inputId}
        onChange={(event) => {
          onChange(event.target.value);
          onSelect(null);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Søk eller skriv eget navn"
        role="combobox"
        ref={inputRef}
        value={value}
      />
      {error ? <span className="mt-1 block text-xs font-bold text-[#C8102E]">{error}</span> : null}
      {selectedProviderId ? <span className="mt-1 block text-xs font-semibold text-emerald-700">Valgt fra leverandørkatalogen</span> : null}

      {isOpen ? (
        <div
          className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-[#DBE4EE] bg-white p-1 shadow-xl"
          id={listId}
          role="listbox"
        >
          {isLoading ? <p className="px-3 py-3 text-sm text-[#5F6F82]">Søker ...</p> : null}
          {!isLoading && results.length === 0 && !showCustom ? (
            <p className="px-3 py-3 text-sm text-[#5F6F82]">Skriv et leverandørnavn.</p>
          ) : null}
          {results.map((provider, index) => (
            <button
              aria-label={provider.name}
              aria-selected={selectedProviderId === provider.id}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${
                activeIndex === index ? "bg-[#F5E6E9]" : "hover:bg-[#F7F9FC]"
              }`}
              id={`${listId}-${index}`}
              key={provider.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseProvider(provider)}
              role="option"
              type="button"
            >
              <ProviderMark
                failed={failedLogos.includes(provider.id)}
                logoPath={provider.logoPath}
                name={provider.name}
                onError={() => setFailedLogos((current) => [...current, provider.id])}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[#0D1B2A]">{provider.name}</span>
                <span className="block text-xs text-[#5F6F82]">{formatCatalogCategory(provider.category)}</span>
              </span>
            </button>
          ))}
          {showCustom ? (
            <button
              aria-selected={!selectedProviderId}
              className={`w-full rounded-lg px-3 py-3 text-left text-sm font-bold text-[#C8102E] ${
                activeIndex === results.length ? "bg-[#F5E6E9]" : "hover:bg-[#FFF8F9]"
              }`}
              id={`${listId}-${results.length}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseProvider(null)}
              role="option"
              type="button"
            >
              Legg til «{value.trim()}»
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ProviderMark({
  name,
  logoPath,
  failed,
  onError,
}: {
  name: string;
  logoPath: string | null;
  failed: boolean;
  onError: () => void;
}) {
  if (logoPath && !failed) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-[#DBE4EE]">
        <Image alt="" height={24} onError={onError} src={logoPath} width={24} />
      </span>
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0D1B2A] text-xs font-black text-white">
      {getProviderInitials(name)}
    </span>
  );
}

function formatCatalogCategory(category: string) {
  const labels: Record<string, string> = {
    streaming: "Strømming",
    music_audio: "Musikk, bøker og lyd",
    gaming: "Spill",
    software_cloud: "Programvare og skylagring",
    security: "Sikkerhet",
    news: "Nyheter",
    fitness: "Trening",
    telecom: "Mobil og internett",
    other: "Annet",
  };
  return labels[category] ?? category;
}
