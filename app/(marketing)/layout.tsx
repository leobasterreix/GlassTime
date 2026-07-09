import MarketingThemeSync from "@/components/MarketingThemeSync";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingThemeSync />
      {children}
    </>
  );
}
