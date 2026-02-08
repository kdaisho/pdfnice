<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let isLoggingOut = $state(false);
</script>

<div class="dashboard">
	<header>
		<h1>Dashboard</h1>
		<form
			method="POST"
			action="?/logout"
			use:enhance={() => {
				isLoggingOut = true;
				return async ({ update }) => {
					await update();
				};
			}}
		>
			<button type="submit" disabled={isLoggingOut}>
				{isLoggingOut ? 'Logging out...' : 'Logout'}
			</button>
		</form>
	</header>

	<div class="content">
		<div class="welcome">
			<h2>Welcome back!</h2>
			<p>Email: <strong>{data.user.email}</strong></p>
			<p>Account Type: <strong>{data.user.is_pro ? 'Pro' : 'Free'}</strong></p>
			<p>Operations Used Today: <strong>{data.user.operation_count}</strong></p>
		</div>

		<div class="features">
			<h3>Available Features</h3>
			<ul>
				<li><a href="/">View & Search PDFs</a></li>
				<li>Merge PDFs (10 operations/day on free tier)</li>
				<li>Split PDFs (10 operations/day on free tier)</li>
				<li>Compress PDFs (10 operations/day on free tier)</li>
			</ul>
		</div>

		{#if !data.user.is_pro}
			<div class="upgrade">
				<h3>Upgrade to Pro</h3>
				<p>Get unlimited operations, larger file support, and priority features.</p>
				<button disabled>Coming Soon: $9/month</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.dashboard {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #eee;
	}

	h1 {
		margin: 0;
		color: #333;
	}

	header form {
		margin: 0;
	}

	header form button {
		padding: 0.5rem 1rem;
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background 0.2s;
	}

	header form button:hover:not(:disabled) {
		background: #c82333;
	}

	header form button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.welcome,
	.features,
	.upgrade {
		padding: 1.5rem;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	h2,
	h3 {
		margin-top: 0;
		color: #333;
	}

	.welcome p {
		margin: 0.5rem 0;
		color: #666;
	}

	.features ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.features li {
		padding: 0.75rem;
		margin: 0.5rem 0;
		background: #f8f9fa;
		border-radius: 4px;
	}

	.features a {
		color: #007bff;
		text-decoration: none;
	}

	.features a:hover {
		text-decoration: underline;
	}

	.upgrade {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.upgrade h3 {
		color: white;
	}

	.upgrade p {
		margin: 1rem 0;
		opacity: 0.9;
	}

	.upgrade button {
		padding: 0.75rem 1.5rem;
		background: white;
		color: #667eea;
		border: none;
		border-radius: 4px;
		font-weight: 600;
		cursor: pointer;
	}

	.upgrade button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
</style>
