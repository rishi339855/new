import { randomBytes } from 'crypto';
import { split, combine } from 'shamirs-secret-sharing';
import { Wallet } from 'ethers';

// Generate a random 32-byte private key
export const generatePrivateKey = (): string => {
    return '0x' + randomBytes(32).toString('hex');
};

// Derive public key and address from private key using ethers.js
export const deriveKeys = (privateKey: string) => {
    const wallet = new Wallet(privateKey);
    return {
        publicKey: wallet.signingKey.publicKey,
        address: wallet.address
    };
};

// Split private key into shares using Shamir's Secret Sharing
// Threshold: 2, Total: 3
export const splitKey = (privateKey: string): string[] => {
    // Remove '0x' prefix if present for splitting
    const secret = Buffer.from(privateKey.replace('0x', ''), 'hex');

    const shares = split(secret, { shares: 3, threshold: 2 });

    // Convert shares to hex strings
    return shares.map((share: Uint8Array) => Buffer.from(share).toString('hex'));
};

// Reconstruct private key from shares
export const reconstructKey = (shares: string[]): string => {
    // Convert hex shares back to Uint8Array
    const shareBuffers = shares.map(share => Uint8Array.from(Buffer.from(share, 'hex')));

    // Combine shares to recover the secret
    const recovered = combine(shareBuffers);

    // Convert back to hex string with 0x prefix
    return '0x' + Buffer.from(recovered).toString('hex');
};
