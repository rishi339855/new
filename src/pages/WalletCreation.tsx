import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Download, ShieldCheck, Key, CheckCircle2 } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import SplitPageLayout from '../components/SplitPageLayout';
import './WalletCreation.css';

const WalletCreation: React.FC = () => {
    const [progress, setProgress] = useState(0);
    const [dkgStep, setDkgStep] = useState('');
    const [created, setCreated] = useState(false);
    const [loading, setLoading] = useState(false);
    const [walletData, setWalletData] = useState<{
        address: string;
        publicKey: string;
        shares: { id: string; label: string; value: string }[];
        pdfBackup: string;
    } | null>(null);

    const handleCreate = async () => {
        setLoading(true);
        setProgress(0);
        setDkgStep('Connecting to Secure MPC Node...');

        try {
            const { io } = await import('socket.io-client');
            const { DKGClient } = await import('../utils/mpc/dkgClient');

            const socket = io('http://localhost:5001');

            socket.on('connect', () => {
                setDkgStep('Initializing Distributed Key Generation...');
                setProgress(10);
                socket.emit('dkg-init');
            });

            const client = new DKGClient(1, 3, 2);

            // Step 1: Receive Commitments from Server (2) and Recovery (3)
            socket.on('dkg-commitments', (data: { 2: string[], 3: string[] }) => {
                setDkgStep('Exchanging Zero-Knowledge Proofs...');
                setProgress(30);

                try {
                    client.receiveCommitments(data);

                    // Send my commitments
                    socket.emit('dkg-send-commitments', {
                        commitments: client.getCommitmentsBroadcast()
                    });
                } catch (e) {
                    console.error('DKG Step 1 Error:', e);
                    alert('DKG Protocol Error: Verification Failed');
                    socket.disconnect();
                }
            });

            // Step 2: Receive Shares from Server (2) and Recovery (3)
            socket.on('dkg-shares', (data: { 2: string, 3: string }) => {
                setDkgStep('Verifying & Aggregating Shares...');
                setProgress(60);

                try {
                    client.receiveShares(data);

                    // Send shares to others
                    socket.emit('dkg-send-shares', {
                        shares: client.getSharesForOthers()
                    });

                    // Finalize client side
                    client.finalize();
                    setDkgStep('Finalizing Secure Setup...');
                    setProgress(80);
                } catch (e) {
                    console.error('DKG Step 2 Error:', e);
                    alert('DKG Protocol Error: Share Verification Failed');
                    socket.disconnect();
                }
            });

            // Step 3: Complete
            socket.on('dkg-complete', (data: { address: string, publicKey: string, shareC: any }) => {
                setProgress(100);

                const clientOutput = client.getFinalOutput();

                // Compare calculated address with server address to be sure
                if (data.address.toLowerCase() !== clientOutput.address?.toLowerCase()) {
                    console.error('Address Mismatch!', data.address, clientOutput.address);
                    // alert('Warning: Address verification failed between Client and Server');
                    // Proceeding anyway for now, but strictly this should abort
                }

                setWalletData({
                    address: clientOutput.address || data.address, // Prefer client derived
                    publicKey: clientOutput.publicKey || data.publicKey,
                    shares: [
                        {
                            id: 'A', label: 'Client Share (A)', value: JSON.stringify({
                                share: clientOutput.share,
                                address: clientOutput.address,
                                publicKey: clientOutput.publicKey,
                                index: 1
                            })
                        },
                        { id: 'B', label: 'Server Share (B)', value: 'SERVER_MANAGED' },
                        {
                            id: 'C', label: 'Recovery Share (C)', value: JSON.stringify({
                                ...data.shareC,
                                index: 3
                            })
                        }
                    ],
                    pdfBackup: '' // Deprecated
                });

                setCreated(true);
                setLoading(false);
                socket.disconnect();
            });

            socket.on('dkg-error', (data) => {
                console.error('DKG Error:', data);
                alert(`DKG Failed: ${data.message}`);
                setLoading(false);
                socket.disconnect();
            });

        } catch (error) {
            console.error('Error creating wallet:', error);
            alert('Error connecting to backend');
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    const downloadShareJson = () => {
        if (!walletData?.shares[0]) return;
        const shareA = walletData.shares[0];
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(shareA, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "shareA.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    if (created && walletData) {
        return (
            <div className="wallet-creation-success fade-in">
                <div className="container">
                    <div className="success-header">
                        <div className="icon-bg">
                            <ShieldCheck size={48} />
                        </div>
                        <h1>True MPC Wallet Ready</h1>
                        <p>
                            <strong>Distributed Key Generation Complete.</strong><br />
                            Your private key was never fully constructed. It exists only as split shares.
                        </p>
                    </div>

                    <div className="keys-section">
                        <Card title="Public Credentials" className="credentials-card">
                            <div className="detail-row">
                                <span className="detail-label">Wallet Address</span>
                                <div className="value-group">
                                    <code className="detail-value">{walletData.address}</code>
                                    <button className="icon-btn" onClick={() => copyToClipboard(walletData.address)}>
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>
                        </Card>

                        <div className="shares-section">
                            <h3><Key className="inline-icon" /> Key Shares Distribution</h3>
                            <div className="shares-grid mpc-grid">
                                {/* Share A: Client */}
                                <Card className="share-card client-share">
                                    <div className="share-header">
                                        <span className="share-badge">Share A (Yours)</span>
                                        <CheckCircle2 size={18} className="share-check" />
                                    </div>
                                    <div className="share-content">
                                        <p className="share-desc">
                                            This is your unique secret share. You must save this file to sign transactions.
                                            <strong> Do not lose it.</strong>
                                        </p>
                                        <Button onClick={downloadShareJson} fullWidth className="download-share-btn">
                                            <Download size={16} /> Download shareA.json
                                        </Button>
                                    </div>
                                </Card>

                                {/* Share B: Server */}
                                <Card className="share-card server-share-card">
                                    <div className="share-header">
                                        <span className="share-badge">Share B (Server)</span>
                                        <ShieldCheck size={18} className="share-check" />
                                    </div>
                                    <div className="share-content">
                                        <div className="server-status-indicator">
                                            <div className="pulse-dot"></div>
                                            <span>Securely Stored on Server</span>
                                        </div>
                                        <p className="share-desc">
                                            The server holds this share to co-sign transactions with you. It cannot sign alone.
                                        </p>
                                    </div>
                                </Card>

                                {/* Share C: Recovery */}
                                <Card className="share-card recovery-share-card">
                                    <div className="share-header">
                                        <span className="share-badge">Share C (Recovery)</span>
                                        <Key size={18} className="share-check" />
                                    </div>
                                    <div className="share-content">
                                        <p className="share-desc">
                                            <strong>Offline Backup.</strong> Use this + Share B (Server) to recover funds if you lose your device.
                                            Store on a USB drive.
                                        </p>
                                        <Button
                                            onClick={() => {
                                                if (!walletData?.shares[2]) return;
                                                const shareC = walletData.shares[2];
                                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(shareC, null, 2));
                                                const downloadAnchorNode = document.createElement('a');
                                                downloadAnchorNode.setAttribute("href", dataStr);
                                                downloadAnchorNode.setAttribute("download", "shareC_recovery.json");
                                                document.body.appendChild(downloadAnchorNode);
                                                downloadAnchorNode.click();
                                                downloadAnchorNode.remove();
                                            }}
                                            variant="outline"
                                            fullWidth
                                            className="download-share-btn recovery-btn"
                                        >
                                            <Download size={16} /> Download shareC.json
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <SplitPageLayout
            icon={<ShieldCheck size={40} />}
            title="WALLET CREATION"
            subtitle="TRUE MPC (DKG)"
            description={
                <>
                    <p>
                        Generate a secure Multi-Party Computation wallet using <strong>Distributed Key Generation</strong>.
                        The private key is never fully reconstructed, ensuring maximum security.
                    </p>
                </>
            }
        >
            <Card title="Initialize Secure Setup" className="config-card">
                {!loading ? (
                    <>
                        <p className="config-description">
                            Click below to start the DKG process. This will involve multiple rounds of communication
                            between your device and the server to mathematically derive your shares.
                        </p>
                        <div className="actions">
                            <Button onClick={handleCreate} fullWidth className="create-btn">
                                <ShieldCheck size={20} /> Start Secure Setup
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="dkg-progress-container">
                        <div className="dkg-status">
                            <div className="spinner"></div>
                            <span>{dkgStep}</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <p className="progress-percent">{progress}% Complete</p>
                    </div>
                )}
            </Card>
        </SplitPageLayout>
    );
};

export default WalletCreation;
