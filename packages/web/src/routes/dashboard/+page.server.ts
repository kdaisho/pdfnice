import { redirect } from '@sveltejs/kit';
import { deleteSession } from '@pdf-splitter/database';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Redirect to setup if not authenticated
	if (!locals.user) {
		redirect(303, '/setup');
	}

	return {
		user: locals.user
	};
};

export const actions: Actions = {
	logout: async ({ cookies }) => {
		const sessionToken = cookies.get('session');

		if (sessionToken) {
			await deleteSession(sessionToken);
			cookies.delete('session', { path: '/' });
		}

		redirect(303, '/');
	}
};
