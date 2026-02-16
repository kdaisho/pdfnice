import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
	generateRegistrationOptions,
	generateAuthenticationOptions,
	verifyRegistrationResponse,
	verifyAuthenticationResponse
} from '@simplewebauthn/server';
import {
	findUserByEmail,
	createUser,
	findPasskeysByUserId,
	createPasskey,
	findPasskeyById,
	updatePasskeyCounter,
	saveChallenge,
	getChallenge,
	deleteChallenge,
	createSession
} from '@pdf-splitter/database';
import type { Actions, PageServerLoad } from './$types';

const RP_ID = process.env.PUBLIC_RP_ID || 'localhost';
const RP_NAME = process.env.PUBLIC_RP_NAME || 'PDF Splitter';
const ORIGIN = process.env.PUBLIC_ORIGIN || 'http://localhost:5173';

const emailSchema = z.object({
	email: z.string().email('Invalid email address')
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

export const load: PageServerLoad = async ({ locals }) => {
	// If already logged in, redirect to dashboard
	if (locals.user) {
		redirect(303, '/dashboard');
	}
	return {};
};

export const actions: Actions = {
	// Registration Step 1: Generate registration options
	getRegistrationOptions: async ({ request }) => {
		const formData = await request.formData();
		const result = emailSchema.safeParse({ email: formData.get('email') });

		if (!result.success) {
			return fail(400, { error: result.error.errors[0].message, mode: 'register' as const });
		}

		const { email } = result.data;

		// Check rate limit
		const rateLimitError = checkRateLimit(email);
		if (rateLimitError) {
			return fail(429, { error: rateLimitError, mode: 'register' as const });
		}

		try {
			// Find or create user
			let user = await findUserByEmail(email);
			if (!user) {
				user = await createUser(email);
			}

			// Get existing passkeys to exclude
			const existingPasskeys = await findPasskeysByUserId(user.id);

			// Generate registration options
			const options = await generateRegistrationOptions({
				rpName: RP_NAME,
				rpID: RP_ID,
				userName: email,
				attestationType: 'none',
				excludeCredentials: existingPasskeys.map((passkey) => ({
					id: passkey.id
				})),
				authenticatorSelection: {
					residentKey: 'preferred',
					userVerification: 'preferred',
					authenticatorAttachment: 'platform'
				}
			});

			// Store challenge temporarily
			await saveChallenge(user.id, options.challenge, options.user.id);

			return {
				options,
				email,
				mode: 'register' as const
			};
		} catch (error) {
			console.error('Registration options error:', error);
			return fail(500, {
				error: 'Failed to generate registration options',
				mode: 'register' as const
			});
		}
	},

	// Registration Step 2: Verify registration response
	verifyRegistration: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const responseJson = formData.get('response') as string;

		if (!email || !responseJson) {
			return fail(400, { error: 'Missing required fields', mode: 'register' as const });
		}

		try {
			const user = await findUserByEmail(email);
			if (!user) {
				return fail(400, { error: 'User not found', mode: 'register' as const });
			}

			// Get stored challenge
			const challengeRecord = await getChallenge(user.id);
			if (!challengeRecord) {
				return fail(400, {
					error: 'Challenge expired. Please try again.',
					mode: 'register' as const
				});
			}

			const response = JSON.parse(responseJson);

			// Verify registration response
			const verification = await verifyRegistrationResponse({
				response,
				expectedChallenge: challengeRecord.challenge,
				expectedOrigin: ORIGIN,
				expectedRPID: RP_ID
			});

			if (!verification.verified || !verification.registrationInfo) {
				return fail(400, { error: 'Verification failed', mode: 'register' as const });
			}

			const { credential, credentialDeviceType, credentialBackedUp } =
				verification.registrationInfo;

			// Save passkey to database
			await createPasskey({
				id: credential.id,
				user_id: user.id,
				webauthn_user_id: challengeRecord.registration_options_user_id!,
				public_key: credential.publicKey,
				counter: credential.counter,
				device_type: credentialDeviceType,
				backed_up: credentialBackedUp,
				transports: response.response.transports || []
			});

			// Delete challenge (one-time use)
			await deleteChallenge(user.id);

			// Create session
			const sessionToken = await createSession(user.id);

			// Set session cookie
			cookies.set('session', sessionToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'strict',
				maxAge: 60 * 60 * 24 * 7, // 7 days
				path: '/'
			});

			redirect(303, '/dashboard');
		} catch (error) {
			// Re-throw redirects (SvelteKit throws redirects as errors)
			if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
				throw error;
			}
			console.error('Registration verification error:', error);
			return fail(500, {
				error: 'Registration failed. Please try again.',
				mode: 'register' as const
			});
		}
	},

	// Login Step 1: Generate authentication options
	getLoginOptions: async ({ request }) => {
		const formData = await request.formData();
		const result = emailSchema.safeParse({ email: formData.get('email') });

		if (!result.success) {
			return fail(400, { error: result.error.errors[0].message, mode: 'login' as const });
		}

		const { email } = result.data;

		// Check rate limit
		const rateLimitError = checkRateLimit(email);
		if (rateLimitError) {
			return fail(429, { error: rateLimitError, mode: 'login' as const });
		}

		try {
			const user = await findUserByEmail(email);
			if (!user) {
				return fail(404, { error: 'No account found with this email', mode: 'login' as const });
			}

			// Get user's passkeys
			const passkeys = await findPasskeysByUserId(user.id);
			if (passkeys.length === 0) {
				return fail(400, {
					error: 'No passkeys registered. Please register first.',
					mode: 'login' as const
				});
			}

			// Generate authentication options
			const options = await generateAuthenticationOptions({
				rpID: RP_ID,
				allowCredentials: passkeys.map((passkey) => ({
					id: passkey.id,
					transports: passkey.transports ? JSON.parse(passkey.transports) : undefined
				})),
				userVerification: 'preferred'
			});

			// Store challenge
			await saveChallenge(user.id, options.challenge);

			return {
				options,
				email,
				mode: 'login' as const
			};
		} catch (error) {
			console.error('Login options error:', error);
			return fail(500, { error: 'Failed to generate login options', mode: 'login' as const });
		}
	},

	// Login Step 2: Verify authentication response
	verifyLogin: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const responseJson = formData.get('response') as string;

		if (!email || !responseJson) {
			return fail(400, { error: 'Missing required fields', mode: 'login' as const });
		}

		try {
			const user = await findUserByEmail(email);
			if (!user) {
				return fail(400, { error: 'User not found', mode: 'login' as const });
			}

			// Get stored challenge
			const challengeRecord = await getChallenge(user.id);
			if (!challengeRecord) {
				return fail(400, { error: 'Challenge expired. Please try again.', mode: 'login' as const });
			}

			const response = JSON.parse(responseJson);

			// Find the passkey being used
			const passkey = await findPasskeyById(response.id);
			if (!passkey || passkey.user_id !== user.id) {
				return fail(400, { error: 'Passkey not found', mode: 'login' as const });
			}

			// Validate userHandle (prevents credential swapping)
			if (
				response.response.userHandle &&
				response.response.userHandle !== passkey.webauthn_user_id
			) {
				return fail(400, { error: 'Invalid credential', mode: 'login' as const });
			}

			// Verify authentication response
			const verification = await verifyAuthenticationResponse({
				response,
				expectedChallenge: challengeRecord.challenge,
				expectedOrigin: ORIGIN,
				expectedRPID: RP_ID,
				credential: {
					id: passkey.id,
					publicKey: passkey.public_key,
					counter: passkey.counter
				}
			});

			if (!verification.verified) {
				return fail(400, { error: 'Verification failed', mode: 'login' as const });
			}

			// Validate counter increment (prevents replay attacks)
			if (verification.authenticationInfo.newCounter <= passkey.counter) {
				console.error('Counter validation failed - possible replay attack');
				return fail(400, { error: 'Authentication failed', mode: 'login' as const });
			}

			// Update counter in database
			await updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);

			// Delete challenge (one-time use)
			await deleteChallenge(user.id);

			// Create session
			const sessionToken = await createSession(user.id);

			// Set session cookie
			cookies.set('session', sessionToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'strict',
				maxAge: 60 * 60 * 24 * 7, // 7 days
				path: '/'
			});

			redirect(303, '/dashboard');
		} catch (error) {
			// Re-throw redirects (SvelteKit throws redirects as errors)
			if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
				throw error;
			}
			console.error('Login verification error:', error);
			return fail(500, { error: 'Login failed. Please try again.', mode: 'login' as const });
		}
	}
};
