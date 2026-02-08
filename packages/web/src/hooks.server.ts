import { findSessionByToken } from '@pdf-splitter/database';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get('session');

	if (sessionToken) {
		try {
			const session = await findSessionByToken(sessionToken);

			if (session && session.user) {
				event.locals.user = session.user;
			}
		} catch (error) {
			console.error('Session validation error:', error);
		}
	}

	return resolve(event);
};
