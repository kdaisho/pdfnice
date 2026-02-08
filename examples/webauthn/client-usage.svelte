<!-- Example: Passkey registration in SvelteKit component -->
<script lang="ts">
  import { trpc } from '$lib/trpc';
  import { startRegistration } from '@simplewebauthn/browser';
  import { goto } from '$app/navigation';

  let email = $state('');
  let loading = $state(false);
  let error = $state('');

  async function registerPasskey() {
    try {
      loading = true;
      error = '';

      // Step 1: Get registration options from server (type-safe!)
      const options = await trpc.auth.getRegistrationOptions.query({ email });

      // Step 2: Trigger device authenticator (Touch ID, Face ID, security key)
      const response = await startRegistration(options);

      // Step 3: Send response to server for verification
      const result = await trpc.auth.verifyRegistration.mutate({
        email,
        registrationResponse: JSON.stringify(response),
      });

      if (result.success) {
        // Session cookie set by server, redirect to dashboard
        await goto('/dashboard');
      }
    } catch (err) {
      if (err instanceof Error) {
        // Handle specific errors
        if (err.name === 'InvalidStateError') {
          error = 'This authenticator is already registered. Try logging in instead.';
        } else {
          error = err.message;
        }
      }
    } finally {
      loading = false;
    }
  }

  async function loginWithPasskey() {
    try {
      loading = true;
      error = '';

      // Step 1: Get login options
      const options = await trpc.auth.getLoginOptions.query({ email });

      // Step 2: Trigger device authenticator
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const response = await startAuthentication(options);

      // Step 3: Verify authentication
      const result = await trpc.auth.verifyLogin.mutate({
        email,
        authenticationResponse: JSON.stringify(response),
      });

      if (result.success) {
        await goto('/dashboard');
      }
    } catch (err) {
      if (err instanceof Error) {
        error = err.message;
      }
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-form">
  <h1>Passkey Authentication</h1>

  <input
    type="email"
    bind:value={email}
    placeholder="Enter your email"
    disabled={loading}
  />

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="button-group">
    <button onclick={registerPasskey} disabled={loading || !email}>
      {loading ? 'Processing...' : 'Register Passkey'}
    </button>

    <button onclick={loginWithPasskey} disabled={loading || !email}>
      {loading ? 'Processing...' : 'Login with Passkey'}
    </button>
  </div>

  <p class="help-text">
    Passkeys use your device's Touch ID, Face ID, or security key for passwordless authentication.
  </p>
</div>

<style>
  .auth-form {
    max-width: 400px;
    margin: 2rem auto;
    padding: 2rem;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    margin-bottom: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  button {
    flex: 1;
    padding: 0.75rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error {
    color: #dc3545;
    margin-bottom: 1rem;
  }

  .help-text {
    font-size: 0.875rem;
    color: #666;
  }
</style>
