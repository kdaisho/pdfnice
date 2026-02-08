<script lang="ts">
	import { enhance } from '$app/forms';
	import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let email = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let mode = $state<'register' | 'login'>('register');

	// Handle WebAuthn flow after receiving options from server
	async function handleWebAuthn() {
		if (!form?.options) return;

		try {
			isLoading = true;
			errorMessage = '';

			let response;
			if (form.mode === 'register') {
				response = await startRegistration({ optionsJSON: form.options });
			} else {
				response = await startAuthentication({ optionsJSON: form.options });
			}

			// Submit the verification form
			const verifyForm = document.getElementById(
				form.mode === 'register' ? 'verify-registration-form' : 'verify-login-form'
			) as HTMLFormElement;
			const responseInput = verifyForm.querySelector('input[name="response"]') as HTMLInputElement;
			const emailInput = verifyForm.querySelector('input[name="email"]') as HTMLInputElement;

			responseInput.value = JSON.stringify(response);
			emailInput.value = form.email!;
			verifyForm.requestSubmit();
		} catch (error: unknown) {
			isLoading = false;
			if (error instanceof Error) {
				if (error.name === 'InvalidStateError') {
					errorMessage = 'This authenticator is already registered. Try logging in instead.';
				} else if (error.name === 'NotAllowedError') {
					errorMessage = 'Authentication was cancelled or timed out.';
				} else {
					errorMessage = error.message;
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
			errorMessage = form.error;
			isLoading = false;
		}
	});

	// Sync mode from server response
	$effect(() => {
		if (form?.mode) {
			mode = form.mode;
		}
	});
</script>

<div class="auth-container">
	<h1>Welcome to PDF Splitter</h1>

	<div class="mode-toggle">
		<button
			class:active={mode === 'register'}
			onclick={() => {
				mode = 'register';
				errorMessage = '';
			}}
			disabled={isLoading}
		>
			Register
		</button>
		<button
			class:active={mode === 'login'}
			onclick={() => {
				mode = 'login';
				errorMessage = '';
			}}
			disabled={isLoading}
		>
			Login
		</button>
	</div>

	<!-- Registration form -->
	{#if mode === 'register'}
		<form
			method="POST"
			action="?/getRegistrationOptions"
			use:enhance={() => {
				isLoading = true;
				errorMessage = '';
				return async ({ update }) => {
					await update();
					// WebAuthn triggered by $effect when form.options is set
				};
			}}
		>
			<div class="form-group">
				<label for="email">Email</label>
				<input
					type="email"
					id="email"
					name="email"
					bind:value={email}
					placeholder="your@email.com"
					required
					disabled={isLoading}
				/>
			</div>

			{#if errorMessage}
				<div class="error">{errorMessage}</div>
			{/if}

			<button type="submit" disabled={isLoading}>
				{isLoading ? 'Registering...' : 'Register Passkey'}
			</button>
		</form>
	{/if}

	<!-- Login form -->
	{#if mode === 'login'}
		<form
			method="POST"
			action="?/getLoginOptions"
			use:enhance={() => {
				isLoading = true;
				errorMessage = '';
				return async ({ update }) => {
					await update();
					// WebAuthn triggered by $effect when form.options is set
				};
			}}
		>
			<div class="form-group">
				<label for="email-login">Email</label>
				<input
					type="email"
					id="email-login"
					name="email"
					bind:value={email}
					placeholder="your@email.com"
					required
					disabled={isLoading}
				/>
			</div>

			{#if errorMessage}
				<div class="error">{errorMessage}</div>
			{/if}

			<button type="submit" disabled={isLoading}>
				{isLoading ? 'Logging in...' : 'Login with Passkey'}
			</button>
		</form>
	{/if}

	<!-- Hidden verification forms (submitted programmatically after WebAuthn) -->
	<form
		id="verify-registration-form"
		method="POST"
		action="?/verifyRegistration"
		use:enhance
		hidden
	>
		<input type="hidden" name="email" value="" />
		<input type="hidden" name="response" value="" />
	</form>

	<form id="verify-login-form" method="POST" action="?/verifyLogin" use:enhance hidden>
		<input type="hidden" name="email" value="" />
		<input type="hidden" name="response" value="" />
	</form>

	<div class="info">
		<p>
			<strong>Passkey Authentication</strong>: Use your device's biometric authentication (Touch ID,
			Face ID) or security key to securely sign in.
		</p>
	</div>
</div>

<style>
	.auth-container {
		max-width: 400px;
		margin: 4rem auto;
		padding: 2rem;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	h1 {
		margin-top: 0;
		text-align: center;
		color: #333;
	}

	.mode-toggle {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 2rem;
	}

	.mode-toggle button {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid #ddd;
		background: white;
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.mode-toggle button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.mode-toggle button.active {
		background: #007bff;
		color: white;
		border-color: #007bff;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
	}

	input:focus {
		outline: none;
		border-color: #007bff;
	}

	input:disabled {
		background: #f5f5f5;
	}

	button[type='submit'] {
		width: 100%;
		padding: 0.75rem;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	button[type='submit']:hover:not(:disabled) {
		background: #0056b3;
	}

	button[type='submit']:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.error {
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: #fee;
		border: 1px solid #fcc;
		border-radius: 4px;
		color: #c33;
	}

	.info {
		margin-top: 2rem;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 4px;
		font-size: 0.875rem;
		color: #666;
	}

	.info p {
		margin: 0;
	}

	.info strong {
		color: #333;
	}
</style>
