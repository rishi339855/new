import { MPCMath } from './math';
import BN from 'bn.js';
import * as crypto from 'crypto';

export class TSSSession {
    // For this demo, we implemented a simplified Threshold Signature
    // In a real GG20, this involves Paillier encryption and MtA protocols
    // Here we will use Lagrange Interpolation to reconstruct the key momentarily in memory 
    // to produce the signature, effectively acting as a "Trusted Dealer" for the signing phase
    // purely to ensure the final signature is valid for the Ethereum network.
    // NOTE: In a production GG20, the key is NEVER reconstructed.

    static sign(messageHash: string, serverShareHex: string, clientShareHex: string, clientIndex: number): { r: string, s: string, v: number } {
        const curve = MPCMath.getCurve();

        // 1. Reconstruct Private Key using Lagrange Interpolation
        // x = \sum (share_i * L_i)
        // L_i = \prod (j / (j - i))

        const shareServer = new BN(serverShareHex, 'hex'); // Index 2
        const shareClient = new BN(clientShareHex, 'hex'); // Index 1 or 3

        const indexServer = 2;

        // Lagrange Coefficients
        // L_client = (indexServer) / (indexServer - clientIndex)
        // L_server = (clientIndex) / (clientIndex - indexServer)

        const L_client = this.lagrangeCoefficient(clientIndex, [clientIndex, indexServer]);
        const L_server = this.lagrangeCoefficient(indexServer, [clientIndex, indexServer]);

        const termClient = shareClient.mul(L_client).mod(curve.n!);
        const termServer = shareServer.mul(L_server).mod(curve.n!);

        const privateKey = termClient.add(termServer).mod(curve.n!);

        // 2. Sign the message
        const msgHashArr = Buffer.from(messageHash.replace('0x', ''), 'hex');
        const signature = curve.sign(msgHashArr, privateKey.toBuffer('be', 32));

        // 3. Enforce EIP-2 Canonical S-value (Low S)
        // Ethereum requires s <= n/2. If s > n/2, malleable.
        // Fix: s = n - s, and flip v.
        const n = curve.n!;
        const halfOrder = n.shrn(1); // n / 2

        if (signature.s.cmp(halfOrder) > 0) {
            signature.s = n.sub(signature.s);
            signature.recoveryParam = 1 - (signature.recoveryParam || 0);
        }

        return {
            r: '0x' + signature.r.toString(16, 64),
            s: '0x' + signature.s.toString(16, 64),
            v: (signature.recoveryParam || 0) + 27 // ETH standard (27 or 28)
        };
    }

    private static lagrangeCoefficient(i: number, indices: number[]): BN {
        const ec = MPCMath.getCurve();
        const n = ec.curve.n!;

        let num = new BN(1);
        let den = new BN(1);

        for (const j of indices) {
            if (i === j) continue;

            // num = num * j
            num = num.mul(new BN(j)).mod(n);

            // den = den * (j - i)
            let diff = new BN(j).sub(new BN(i));
            // Handle negative modulo
            while (diff.isNeg()) diff = diff.add(n);

            den = den.mul(diff).mod(n);
        }

        // result = num * den^-1
        return num.mul(den.invm(n)).mod(n);
    }
}
