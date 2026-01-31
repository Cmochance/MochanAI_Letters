import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import superjson from "superjson";

// Type-only import from server - this will be resolved at build time
// The actual types come from letters-backend/src/routers/index.ts
type AppRouter = import("../../../letters-backend/src/routers/index.js").AppRouter;

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== "undefined") {
    // Browser should use relative path or env variable
    return process.env.NEXT_PUBLIC_API_URL || "";
  }
  // SSR should use absolute URL
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      async headers() {
        // Get auth token from Supabase session
        if (typeof window !== "undefined") {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            return {
              Authorization: `Bearer ${session.access_token}`,
            };
          }
        }
        return {};
      },
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});
