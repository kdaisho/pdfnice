// src/routes/signin/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
	generateAuthenticationOptions,
	verifyAuthenticationResponse
} from '@simplewebauthn/server';
import type { Actions } from './$types';

const { RP_ID, ORIGIN } = process.env;

const emailSchema = z.object({
	email: z.string().email()
});

// Rate limiting (in-memory, resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(email: string): string | null {
	const now = Date.now();
	const key = email.toLowerCase();
	const record = rateLimitMap.get(key);

	if (!record || now > record.resetTime) {
		rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
		return null;
	}

	if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
		return 'Too many attempts. Please try again later.';
	}

	record.count++;
	return null;
}

export const actions: Actions = {
	// Login Step 1: Generate authentication challenge
	getOptions: async ({ request }) => {
		const formData = await request.formData();
		const result = emailSchema.safeParse({ email: formData.get('email') });

		if (!result.success) {
			return fail(400, { error: 'Invalid email address' });
		}

		const { email } = result.data;

		// Check rate limit
		const rateLimitError = checkRateLimit(email);
		if (rateLimitError) {
			return fail(429, { error: rateLimitError });
		}

		// 1. Find user
		// const user = await findUserByEmail(email);
		// if (!user) return fail(404, { error: 'User not found' });

		// 2. Get user's passkeys
		// const userPasskeys = await getUserPasskeys(user.id);

		// 3. Generate authentication options
		const options = await generateAuthenticationOptions({
			rpID: RP_ID!,
			// allowCredentials: userPasskeys.map((passkey) => ({
			//   id: passkey.id,
			//   transports: passkey.transports,
			// })),
			userVerification: 'preferred'
		});

		// 4. Save challenge (5-minute TTL)
		// await saveChallenge(user.id, options.challenge);

		return { options, email };
	},

	// Login Step 2: Verify authentication response
	verify: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const responseJson = formData.get('response') as string;

		if (!email || !responseJson) {
			return fail(400, { error: 'Missing required fields' });
		}

		const response = JSON.parse(responseJson);

		// 1. Find user and challenge
		// const user = await findUserByEmail(email);
		// const challenge = await getChallenge(user.id);
		// if (!challenge) return fail(400, { error: 'Challenge expired' });

		// 2. Find the passkey being used
		// const passkey = await getPasskey(response.id);
		// if (!passkey) return fail(400, { error: 'Passkey not found' });

		// 3. Validate userHandle (prevents credential swapping)
		// if (response.response.userHandle !== passkey.webauthn_user_id) {
		//   return fail(400, { error: 'Invalid credential' });
		// }

		// 4. Verify authentication response
		const verification = await verifyAuthenticationResponse({
			response,
			expectedChallenge: 'challenge.challenge', // Replace with actual
			expectedOrigin: ORIGIN!,
			expectedRPID: RP_ID!,
			credential: {
				id: 'passkey.id',
				publicKey: new Uint8Array(), // passkey.public_key
				counter: 0 // passkey.counter
			}
		});

		if (!verification.verified) {
			return fail(400, { error: 'Verification failed' });
		}

		// 5. Validate counter increment (prevents replay attacks)
		// if (verification.authenticationInfo.newCounter <= passkey.counter) {
		//   return fail(400, { error: 'Invalid counter' });
		// }

		// 6. Update counter in database
		// await updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);

		// 7. Create session
		const sessionToken = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

		// await saveSession({ user_id: user.id, token: sessionToken, expires_at: expiresAt });

		// 8. Set httpOnly session cookie
		cookies.set('session', sessionToken, {
			httpOnly: true,
			secure: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 7, // 7 days
			path: '/'
		});

		// 9. Delete challenge (one-time use)
		// await deleteChallenge(user.id);

		redirect(303, '/dashboard');
	},

	// Logout
	logout: async ({ cookies }) => {
		const sessionToken = cookies.get('session');

		if (sessionToken) {
			// await deleteSession(sessionToken);
			cookies.delete('session', { path: '/' });
		}

		redirect(303, '/');
	}
};
