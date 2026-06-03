import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/my-car")({
  head: () => ({
    meta: [
      { title: "My Car — C-Tech Automotive" },
      {
        name: "description",
        content:
          "Personal vehicle service portal — track service status, history, and book appointments.",
      },
    ],
  }),
  component: () => <Outlet />,
});
