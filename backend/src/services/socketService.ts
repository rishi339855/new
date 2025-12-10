import { Server, Socket } from 'socket.io';
import { DKGSession } from '../utils/mpc/dkgSession';
import fs from 'fs';
import path from 'path';
import { ShareStore } from '../store';

// Store active sessions: Map<socketId, { server: DKGSession, recovery: DKGSession }>
const activeSessions: { [id: string]: { server: DKGSession, recovery: DKGSession } } = {};

export const initializeSocketIO = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        console.log('New client connected:', socket.id);

        // DKG Events
        socket.on('dkg-init', () => {
            console.log('DKG Init for:', socket.id);
            try {
                // Initialize Server (Party 2) and Recovery (Party 3) sessions
                // Total parties = 3, Threshold = 2
                const serverSession = new DKGSession(2, 3, 2);
                const recoverySession = new DKGSession(3, 3, 2);

                activeSessions[socket.id] = { server: serverSession, recovery: recoverySession };

                // Broadcast Commitments of 2 and 3 to Client (Party 1)
                const comms2 = serverSession.getCommitmentsBroadcast();
                const comms3 = recoverySession.getCommitmentsBroadcast();

                socket.emit('dkg-commitments', {
                    2: comms2,
                    3: comms3
                });
            } catch (e) {
                console.error(e);
                socket.emit('dkg-error', { message: 'Failed to init DKG' });
            }
        });

        // Step 2: Receive Client's Commitments
        socket.on('dkg-send-commitments', (data: { commitments: string[] }) => {
            const sessions = activeSessions[socket.id];
            if (!sessions) return;

            try {
                const clientComms = data.commitments;

                // Update Server and Recovery sessions with Client's commitments
                sessions.server.receiveCommitment(1, clientComms);
                sessions.recovery.receiveCommitment(1, clientComms);

                // Also "exchange" commitments between 2 and 3 (internal)
                sessions.server.receiveCommitment(3, sessions.recovery.getCommitmentsBroadcast());
                sessions.recovery.receiveCommitment(2, sessions.server.getCommitmentsBroadcast());

                // Now ready to share secrets?
                // Server and Recovery need to generate shares for Client (1)
                const share2to1 = sessions.server.getShareForParty(1);
                const share3to1 = sessions.recovery.getShareForParty(1);

                // Send shares to Client
                socket.emit('dkg-shares', {
                    2: share2to1,
                    3: share3to1
                });
            } catch (e) {
                console.error(e);
                socket.emit('dkg-error', { message: 'Invalid commitments' });
            }
        });

        // Step 3: Receive Client's Shares for Server and Recovery
        socket.on('dkg-send-shares', async (data: { shares: { 2: string, 3: string } }) => {
            const sessions = activeSessions[socket.id];
            if (!sessions) return;

            try {
                // Receive shares from Client
                sessions.server.receiveShare(1, data.shares[2]);
                sessions.recovery.receiveShare(1, data.shares[3]);

                // Exchange internal shares between 2 and 3
                const share2to3 = sessions.server.getShareForParty(3);
                const share3to2 = sessions.recovery.getShareForParty(2);

                sessions.recovery.receiveShare(2, share2to3);
                sessions.server.receiveShare(3, share3to2);

                // Finalize both sessions
                sessions.server.finalize();
                sessions.recovery.finalize();

                const serverResult = sessions.server.getFinalOutput();
                const recoveryResult = sessions.recovery.getFinalOutput();

                // Save Server Share (Securely - to MongoDB)
                if (serverResult.address && serverResult.share) {
                    // Update store signature to accept public key? Or just pass it in object
                    // Currently store.ts logic writes 'Pending'. 
                    // Let's modify store.ts to accept publicKey or pass it here if we update store signature.
                    // For now, I'll update store.ts signature in next step.
                    await ShareStore.saveShare(serverResult.address, serverResult.share, serverResult.publicKey || '');
                }

                // Send Recovery Share (C) to Client to download
                // Send "Success" signals
                socket.emit('dkg-complete', {
                    address: serverResult.address,
                    publicKey: serverResult.publicKey,
                    shareC: recoveryResult // Client will download this
                    // Share B (Server) is kept hidden
                });

                // Cleanup ephemeral sessions (simulating "Burning" the context)
                delete activeSessions[socket.id];

            } catch (e) {
                console.error('DKG Finalization Error:', e);
                socket.emit('dkg-error', { message: 'Failed to finalize DKG' });
            }
        });

        // TSS Events (Placeholder for now)
        socket.on('tss-init', (data) => {
            console.log('TSS Initialization requested by:', socket.id);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            delete activeSessions[socket.id];
        });
    });
};
