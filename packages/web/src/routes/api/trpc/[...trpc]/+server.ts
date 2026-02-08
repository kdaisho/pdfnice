import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '$lib/server/routers/_app';
import { createContext } from '$lib/server/trpc';
import type { RequestEvent } from '@sveltejs/kit';

const handler = (event: RequestEvent) =>
	fetchRequestHandler({
		endpoint: '/api/trpc',
		req: event.request,
		router: appRouter,
		createContext: () => createContext(event)
	});

export const GET = handler;
export const POST = handler;
