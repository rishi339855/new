import { ec as EC } from 'elliptic';
import BN from 'bn.js';

const ec = new EC('secp256k1');
const curve = ec.curve;
const n = curve.n; // Order of the curve

export class MPCMath {
    static getCurve() {
        return ec;
    }

    // Generate a random scalar (private key part) - Browser Version
    static randomScalar(): BN {
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return new BN(array).mod(n!);
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

        // Horner's method
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
            rhs = rhs.add(term);
        }

        return lhs.eq(rhs);
    }

    // Convert Point to Hex
    static pointToHex(point: any): string {
        return point.encode('hex', true);
    }
}
