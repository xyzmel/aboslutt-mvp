import type { ButtonHTMLAttributes, ReactNode } from "react";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  loadingLabel?: string;
  variant?: "primary" | "secondary" | "destructive";
  children: ReactNode;
};

export function LoadingButton({
  children,
  className = "",
  disabled,
  isLoading = false,
  loadingLabel = "Lagrer...",
  variant = "primary",
  ...props
}: LoadingButtonProps) {
  const variantClass = {
    primary: "bg-[#C8102E] text-white hover:bg-[#a90d27]",
    secondary: "border border-[#DBE4EE] bg-white text-[#0D1B2A] hover:border-[#C8102E]/50",
    destructive: "border border-[#F3C3CC] bg-white text-[#C8102E] hover:bg-[#F5E6E9]",
  }[variant];

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${variantClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {loadingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
