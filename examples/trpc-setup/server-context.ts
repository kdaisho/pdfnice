// src/lib/server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import type { RequestEvent } from '@sveltejs/kit';

// Create context for each request (includes user session from SvelteKit hooks)
export async function createContext(event: RequestEvent) {
  return {
    user: event.locals.user,  // Populated by hooks.server.ts
    cookies: event.cookies,
  };
}

type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize TRPC
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure middleware - requires authentication
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({ ctx: { user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(isAuthed);
