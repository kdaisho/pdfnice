<script lang="ts">
	import { trpc } from '$lib/trpc';
	import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
	import { goto } from '$app/navigation';

	let email = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let mode = $state<'register' | 'login'>('register');

	async function handleRegister() {
		if (!email) {
			errorMessage = 'Please enter an email address';
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			// Get registration options
			const options = await trpc().auth.getRegistrationOptions.mutate({ email });

			// Start WebAuthn registration
			const registrationResponse = await startRegistration(options);

			// Verify registration
			await trpc().auth.verifyRegistration.mutate({
				email,
				registrationResponse: JSON.stringify(registrationResponse)
			});

			// Redirect to dashboard
			goto('/dashboard');
		} catch (error: any) {
			console.error('Registration error:', error);
			errorMessage = error.message || 'Registration failed. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	async function handleLogin() {
		if (!email) {
			errorMessage = 'Please enter an email address';
			return;
		}

		isLoading = true;
		errorMessage = '';

		try {
			// Get login options
			const options = await trpc().auth.getLoginOptions.mutate({ email });

			// Start WebAuthn authentication
			const authenticationResponse = await startAuthentication(options);

			// Verify authentication
			await trpc().auth.verifyLogin.mutate({
				email,
				authenticationResponse: JSON.stringify(authenticationResponse)
			});

			// Redirect to dashboard
			goto('/dashboard');
		} catch (error: any) {
			console.error('Login error:', error);
			errorMessage = error.message || 'Login failed. Please try again.';
		} finally {
			isLoading = false;
		}
	}
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
		>
			Register
		</button>
		<button
			class:active={mode === 'login'}
			onclick={() => {
				mode = 'login';
				errorMessage = '';
			}}
		>
			Login
		</button>
	</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			if (mode === 'register') {
				handleRegister();
			} else {
				handleLogin();
			}
		}}
	>
		<div class="form-group">
			<label for="email">Email</label>
			<input
				type="email"
				id="email"
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
			{#if isLoading}
				{mode === 'register' ? 'Registering...' : 'Logging in...'}
			{:else}
				{mode === 'register' ? 'Register Passkey' : 'Login with Passkey'}
			{/if}
		</button>
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
