<!-- Example: Passkey login in SvelteKit with form actions -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { startAuthentication } from '@simplewebauthn/browser';
	import type { ActionData } from './$types';

	// ActionData from +page.server.ts
	let { form }: { form: ActionData } = $props();

	let loading = $state(false);
	let error = $state('');

	// Handle the WebAuthn flow after getting options from server
	async function handleWebAuthn() {
		if (!form?.options) return;

		try {
			loading = true;
			error = '';

			// Trigger device authenticator (Touch ID, Face ID, security key)
			const response = await startAuthentication(form.options);

			// Submit the response via the verify form
			const verifyForm = document.getElementById('verify-form') as HTMLFormElement;
			const responseInput = verifyForm.querySelector('input[name="response"]') as HTMLInputElement;
			responseInput.value = JSON.stringify(response);
			verifyForm.requestSubmit();
		} catch (err) {
			loading = false;
			if (err instanceof Error) {
				if (err.name === 'NotAllowedError') {
					error = 'Authentication was cancelled or timed out.';
				} else {
					error = err.message;
				}
			}
		}
	}

	// Watch for options from server to trigger WebAuthn
	$effect(() => {
		if (form?.options) {
			handleWebAuthn();
		}
	});

	// Display server errors
	$effect(() => {
		if (form?.error) {
			error = form.error;
			loading = false;
		}
	});
</script>

<div class="auth-form">
	<h1>Login with Passkey</h1>

	<!-- Step 1: Get authentication options -->
	<form
		method="POST"
		action="?/getOptions"
		use:enhance={() => {
			loading = true;
			error = '';
			return async ({ update }) => {
				await update();
				// WebAuthn triggered by $effect when form.options is set
			};
		}}
	>
		<input type="email" name="email" placeholder="Enter your email" required disabled={loading} />

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<button type="submit" disabled={loading}>
			{loading ? 'Authenticating...' : 'Continue with Passkey'}
		</button>
	</form>

	<!-- Step 2: Verify authentication (hidden, submitted programmatically) -->
	<form id="verify-form" method="POST" action="?/verify" use:enhance hidden>
		<input type="hidden" name="email" value={form?.email ?? ''} />
		<input type="hidden" name="response" />
	</form>

	<p class="help-text">
		Passkeys use your device's Touch ID, Face ID, or security key for passwordless authentication.
	</p>

	<p class="signup-link">
		Don't have an account? <a href="/signup">Register a passkey</a>
	</p>
</div>

<style>
	.auth-form {
		max-width: 400px;
		margin: 2rem auto;
		padding: 2rem;
	}

	input[type='email'] {
		width: 100%;
		padding: 0.75rem;
		margin-bottom: 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		box-sizing: border-box;
	}

	button {
		width: 100%;
		padding: 0.75rem;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		margin-bottom: 1rem;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error {
		color: #dc3545;
		margin-bottom: 1rem;
		padding: 0.5rem;
		background: #fee;
		border-radius: 4px;
	}

	.help-text {
		font-size: 0.875rem;
		color: #666;
		margin-bottom: 1rem;
	}

	.signup-link {
		font-size: 0.875rem;
		text-align: center;
	}

	.signup-link a {
		color: #007bff;
	}
</style>
