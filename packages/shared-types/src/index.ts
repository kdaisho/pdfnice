// Core domain types
export interface User {
	id: string;
	email: string;
	created_at: Date;
	operation_count: number; // For rate limiting (daily operations)
	is_pro: boolean;
}

export interface Session {
	id: string;
	user_id: string;
	token: string;
	expires_at: Date;
	created_at: Date;
	user?: User;
}

export interface Passkey {
	id: string; // credential.id from WebAuthn
	user_id: string;
	webauthn_user_id: string; // From registration options
	public_key: Uint8Array;
	counter: number;
	device_type: 'singleDevice' | 'multiDevice';
	backed_up: boolean;
	transports: string; // JSON array
	name: string | null; // User-friendly name (e.g., "MacBook Pro Touch ID")
	created_at: Date;
}

export interface CurrentChallenge {
	id: number;
	user_id: string;
	challenge: string;
	registration_options_user_id: string | null; // Only for registration flow
	created_at: Date;
	expires_at: Date;
}
