import { ec as EC } from 'elliptic';
import BN from 'bn.js';
import * as crypto from 'crypto';

const ec = new EC('secp256k1');
const curve = ec.curve;
const n = curve.n; // Order of the curve

export class MPCMath {
    static getCurve() {
        return ec;
    }

    // Generate a random scalar (private key part)
    static randomScalar(): BN {
        return new BN(crypto.randomBytes(32)).mod(n!);
    }

    // Generate a random polynomial with degree t and secret a0
    static generatePolynomial(secret: BN, degree: number): BN[] {
        const poly: BN[] = [secret];
        for (let i = 1; i <= degree; i++) {
            poly.push(this.randomScalar());
        }
        return poly;
    }

    // Evaluate polynomial at x
    static evaluatePolynomial(poly: BN[], x: number): BN {
        const xBN = new BN(x);
        let result = new BN(0);

        // Horner's method or simple sum
        for (let i = poly.length - 1; i >= 0; i--) {
            result = result.mul(xBN).add(poly[i]).mod(n!);
        }
        return result;
    }

    // Get public commitments (C_k = a_k * G)
    static getCommitments(poly: BN[]): any[] {
        return poly.map(coeff => ec.g.mul(coeff));
    }

    // Verify a share against commitments (Feldman's VSS)
    // s_j = sum(C_k * j^k) check
    // g^s_j == product(C_k^(j^k))
    static verifyShare(share: BN, index: number, commitments: any[]): boolean {
        const x = new BN(index);

        // LHS: g^share
        const lhs = ec.g.mul(share);

        // RHS: product(C_k^(x^k))
        let rhs = commitments[0]; // C_0 * x^0
        let xToK = new BN(1); // x^0

        for (let k = 1; k < commitments.length; k++) {
            xToK = xToK.mul(x).mod(n!); // x^k
            const term = commitments[k].mul(xToK);
            rhs = rhs.add(term); // Add points (elliptic curve addition)
        }

        return lhs.eq(rhs);
    }

    // Convert Point to Hex
    static pointToHex(point: any): string {
        return point.encode('hex', true);
    }
}
