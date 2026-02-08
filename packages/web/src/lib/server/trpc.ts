import { initTRPC, TRPCError } from '@trpc/server';
import type { RequestEvent } from '@sveltejs/kit';
import type { User } from '@pdf-splitter/shared-types';

// Create context from SvelteKit event
export async function createContext(event: RequestEvent) {
	return {
		user: event.locals.user as User | undefined,
		cookies: event.cookies
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize TRPC
const t = initTRPC.context<Context>().create();

// Base exports
export const router = t.router;
export const publicProcedure = t.procedure;

// Auth middleware
const isAuthed = t.middleware(({ ctx, next }) => {
	if (!ctx.user) {
		throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
	}
	return next({
		ctx: {
			...ctx,
			user: ctx.user
		}
	});
});

// Protected procedure (requires auth)
export const protectedProcedure = t.procedure.use(isAuthed);
