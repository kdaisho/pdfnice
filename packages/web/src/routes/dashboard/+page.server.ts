import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Redirect to setup if not authenticated
	if (!locals.user) {
		throw redirect(302, '/setup');
	}

	return {
		user: locals.user
	};
};
