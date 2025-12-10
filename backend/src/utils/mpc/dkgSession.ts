import { MPCMath } from './math';
import BN from 'bn.js';
import { computeAddress } from 'ethers';

export interface DKGState {
    index: number; // Party Index (1, 2, 3...)
    secret: BN; // My contribution (u_i)
    polynomial: BN[];
    commitments: any[];
    receivedShares: { [fromIndex: number]: BN };
    receivedCommitments: { [fromIndex: number]: any[] };
    finalShare: BN | null;
    publicKey: any | null;
}

export class DKGSession {
    state: DKGState;
    threshold: number;
    totalParties: number;

    constructor(index: number, totalParties: number, threshold: number) {
        this.totalParties = totalParties;
        this.threshold = threshold;
        const secret = MPCMath.randomScalar();
        const polynomial = MPCMath.generatePolynomial(secret, threshold - 1);

        this.state = {
            index,
            secret,
            polynomial,
            commitments: MPCMath.getCommitments(polynomial),
            receivedShares: {},
            receivedCommitments: {},
            finalShare: null,
            publicKey: null
        };

        // Add my own share to myself (loopback)
        this.state.receivedShares[index] = MPCMath.evaluatePolynomial(polynomial, index);
        this.state.receivedCommitments[index] = this.state.commitments;
    }

    // Step 1: Get data to broadcast (Commitments)
    getCommitmentsBroadcast() {
        return this.state.commitments.map(c => MPCMath.pointToHex(c));
    }

    // Step 2: Get private share for a specific party
    getShareForParty(partyIndex: number): string {
        const share = MPCMath.evaluatePolynomial(this.state.polynomial, partyIndex);
        return share.toString('hex');
    }

    // Step 3: Receive Commitment from another party
    receiveCommitment(fromIndex: number, commitmentsHex: string[]) {
        const curve = MPCMath.getCurve();
        const comms = commitmentsHex.map(hex => curve.keyFromPublic(hex, 'hex').getPublic());
        this.state.receivedCommitments[fromIndex] = comms;
    }

    // Step 4: Receive Private Share from another party
    receiveShare(fromIndex: number, shareHex: string) {
        const share = new BN(shareHex, 'hex');

        // Verify VSS
        const commitments = this.state.receivedCommitments[fromIndex];
        if (!commitments) throw new Error(`No commitments found for party ${fromIndex}`);

        const valid = MPCMath.verifyShare(share, this.state.index, commitments);
        if (!valid) throw new Error(`Invalid share received from party ${fromIndex}`);

        this.state.receivedShares[fromIndex] = share;
    }

    // Step 5: Finalize and compute my final share
    finalize() {
        if (Object.keys(this.state.receivedShares).length !== this.totalParties) {
            throw new Error('Missing shares from some parties');
        }

        const curve = MPCMath.getCurve();
        const n = curve.n!;

        // Sum received shares
        let totalShare = new BN(0);
        Object.values(this.state.receivedShares).forEach(s => {
            totalShare = totalShare.add(s).mod(n);
        });
        this.state.finalShare = totalShare;

        // Compute Global Public Key (Sum of all parties' constant commitments C_0)
        let totalPublicKey = this.state.receivedCommitments[this.state.index][0]; // Start with self
        // Actually, start with "Zero" point? No, just sum everyone's C_0

        // Correct logic: PublicKey = Sum(C_{j,0}) for all j
        // Reset to first
        let first = true;
        Object.values(this.state.receivedCommitments).forEach(comms => {
            if (first) {
                totalPublicKey = comms[0];
                first = false;
            } else {
                totalPublicKey = totalPublicKey.add(comms[0]);
            }
        });

        this.state.publicKey = totalPublicKey;
    }

    getFinalOutput() {
        return {
            share: this.state.finalShare?.toString('hex'),
            publicKey: this.state.publicKey ? MPCMath.pointToHex(this.state.publicKey) : null,
            address: this.state.publicKey ? this.deriveAddress(this.state.publicKey) : null
        };
    }

    // Helper to derive ETH address
    deriveAddress(point: any): string {
        // Point is an elliptic curve point object
        // We need uncompressed public key hex: 04 + x + y
        // Ensure x and y are zero-padded to 64 chars (32 bytes)
        const x = point.getX().toString(16, 64).padStart(64, '0');
        const y = point.getY().toString(16, 64).padStart(64, '0');
        const pubKeyHex = "0x04" + x + y;
        return computeAddress(pubKeyHex);
    }
}
