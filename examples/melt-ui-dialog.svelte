<script lang="ts">
	import { createDialog } from '@melt-ui/svelte';

	const {
		elements: { trigger, overlay, content, title, description, close },
		states: { open }
	} = createDialog();

	// Your custom logic
	function handleUpgrade() {
		// Call TRPC mutation for Stripe checkout
		// window.location.href = checkoutUrl;
	}
</script>

<button use:melt={$trigger}>Upgrade to Pro</button>

{#if $open}
	<div use:melt={$overlay} class="dialog-overlay" />
	<div use:melt={$content} class="dialog-content">
		<h2 use:melt={$title}>Unlock Pro Features</h2>
		<p use:melt={$description}>Get unlimited merges, 100MB+ files, and priority support.</p>
		<button onclick={handleUpgrade}>Subscribe - $9/mo</button>
		<button use:melt={$close}>Cancel</button>
	</div>
{/if}

<style>
	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 50;
	}

	.dialog-content {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
		max-width: 400px;
		z-index: 51;
	}

	h2 {
		margin: 0 0 1rem;
		font-size: 1.5rem;
	}

	p {
		margin: 0 0 1.5rem;
		color: #666;
	}

	button {
		margin-right: 0.5rem;
	}
</style>
