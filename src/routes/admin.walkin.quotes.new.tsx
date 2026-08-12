import { createFileRoute } from "@tanstack/react-router";
import { QuoteBuilder } from "@/components/QuoteBuilder";

export const Route = createFileRoute("/admin/walkin/quotes/new")({
  component: () => <QuoteBuilder />,
});
