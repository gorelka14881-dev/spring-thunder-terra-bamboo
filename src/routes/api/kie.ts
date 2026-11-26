import { createFileRoute } from "@tanstack/react-router";
import { handleKie } from "@/darkhorse/kie.server";

export const Route = createFileRoute("/api/kie")({
  server: {
    handlers: {
      GET: ({ request }) => handleKie(request),
      POST: ({ request }) => handleKie(request),
    },
  },
});
