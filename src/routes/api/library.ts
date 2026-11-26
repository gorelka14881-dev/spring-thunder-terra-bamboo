import { createFileRoute } from "@tanstack/react-router";
import { handleLibrary } from "@/darkhorse/library.server";

export const Route = createFileRoute("/api/library")({
  server: {
    handlers: {
      GET: ({ request }) => handleLibrary(request),
      POST: ({ request }) => handleLibrary(request),
    },
  },
});
