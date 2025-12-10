import { MPCMath } from './math';
import BN from 'bn.js';
import { computeAddress } from 'ethers';

export interface DKGState {
    index: number; // Party Index (Client is 1)
    secret: BN;
    polynomial: BN[];
    commitments: any[];
    receivedShares: { [fromIndex: number]: BN };
    receivedCommitments: { [fromIndex: number]: any[] };
    finalShare: BN | null;
    publicKey: any | null;
}

export class DKGClient {
    state: DKGState;
    threshold: number;
    totalParties: number;

    constructor(index: number = 1, totalParties: number = 3, threshold: number = 2) {
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

        // Add my own share to myself
        this.state.receivedShares[index] = MPCMath.evaluatePolynomial(polynomial, index);
        this.state.receivedCommitments[index] = this.state.commitments;
    }

    getCommitmentsBroadcast() {
        return this.state.commitments.map(c => MPCMath.pointToHex(c));
    }

    // Step: Receive Commitments from Server (Party 2) and Recovery (Party 3)
    receiveCommitments(commitmentsMap: { [index: number]: string[] }) {
        const curve = MPCMath.getCurve();
        Object.entries(commitmentsMap).forEach(([indexStr, hexs]) => {
            const index = parseInt(indexStr);
            const comms = hexs.map(hex => curve.keyFromPublic(hex, 'hex').getPublic());
            this.state.receivedCommitments[index] = comms;
        });
    }

    // Step: Send Shares to Server (for 2 and 3)
    getSharesForOthers(): { [index: number]: string } {
        const shares: { [index: number]: string } = {};
        for (let i = 1; i <= this.totalParties; i++) {
            if (i !== this.state.index) {
                shares[i] = MPCMath.evaluatePolynomial(this.state.polynomial, i).toString('hex');
            }
        }
        return shares;
    }

    // Step: Receive Shares from Server (from 2 and 3)
    receiveShares(sharesMap: { [index: number]: string }) {
        Object.entries(sharesMap).forEach(([indexStr, shareHex]) => {
            const index = parseInt(indexStr);
            const share = new BN(shareHex, 'hex');

            // Verify VSS
            const commitments = this.state.receivedCommitments[index];
            if (!commitments) throw new Error(`No commitments found for party ${index}`);

            const valid = MPCMath.verifyShare(share, this.state.index, commitments);
            if (!valid) throw new Error(`Invalid share received from party ${index}`);

            this.state.receivedShares[index] = share;
        });
    }

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

        // Compute Global Public Key (Sum of all C_0)
        let totalPublicKey = this.state.receivedCommitments[this.state.index][0]; // Start with self

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
        // We need X and Y for address derivation
        const point = this.state.publicKey;
        // Fix: Use the same address derivation string format logic as backend or just standard ethers
        let address = '';
        if (point) {
            const x = point.getX().toString(16, 64).padStart(64, '0');
            const y = point.getY().toString(16, 64).padStart(64, '0');
            const pubKeyHex = "0x04" + x + y;
            address = computeAddress(pubKeyHex);
        }

        return {
            share: this.state.finalShare?.toString('hex'),
            publicKey: this.state.publicKey ? MPCMath.pointToHex(this.state.publicKey) : null,
            address: address
        };
    }
}
