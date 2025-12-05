import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Download, ShieldCheck, Key, CheckCircle2 } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import SplitPageLayout from '../components/SplitPageLayout';
import './WalletCreation.css';

const WalletCreation: React.FC = () => {
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
        try {
            // Updated to port 5001
            const response = await fetch('http://localhost:5001/api/create-wallet', {
                method: 'POST',
            });
            const data = await response.json();

            if (data.success) {
                setWalletData(data.data);
                setCreated(true);
            } else {
                alert('Failed to create wallet');
            }
        } catch (error) {
            console.error('Error creating wallet:', error);
            alert('Error connecting to backend');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    const downloadPDF = () => {
        if (!walletData?.pdfBackup) return;
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${walletData.pdfBackup}`;
        link.download = `mpc-wallet-backup-${walletData.address.slice(0, 8)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (created && walletData) {
        return (
            <div className="wallet-creation-success fade-in">
                <div className="container">
                    <div className="success-header">
                        <div className="icon-bg">
                            <ShieldCheck size={48} />
                        </div>
                        <h1>Wallet Created Successfully</h1>
                        <p>Your secure 2-of-3 MPC wallet is ready. Save your credentials safely.</p>
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
                            <div className="detail-row">
                                <span className="detail-label">Public Key</span>
                                <div className="value-group">
                                    <code className="detail-value">{walletData.publicKey}</code>
                                    <button className="icon-btn" onClick={() => copyToClipboard(walletData.publicKey)}>
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>
                        </Card>

                        <div className="shares-section">
                            <h3><Key className="inline-icon" /> Your Private Shares (Threshold: 2/3)</h3>
                            <div className="shares-grid">
                                {walletData.shares.map((share) => (
                                    <Card key={share.id} className="share-card">
                                        <div className="share-header">
                                            <span className="share-badge">{share.label}</span>
                                            <CheckCircle2 size={18} className="share-check" />
                                        </div>
                                        <div className="qr-container">
                                            <QRCodeSVG value={share.value} size={120} />
                                        </div>
                                        <div className="share-value-container">
                                            <code className="share-value">{share.value}</code>
                                        </div>
                                        <div className="share-actions">
                                            <Button
                                                variant="secondary"
                                                onClick={() => copyToClipboard(share.value)}
                                                className="btn-sm"
                                                fullWidth
                                            >
                                                <Copy size={14} /> Copy Share
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        <div className="backup-action">
                            <Card className="backup-card">
                                <div className="backup-content">
                                    <div className="backup-text">
                                        <h3>Download Secure Backup</h3>
                                        <p>This PDF contains all your keys, shares, and QR codes. Store it offline.</p>
                                    </div>
                                    <Button onClick={downloadPDF} className="download-btn">
                                        <Download size={20} /> Download Complete Backup PDF
                                    </Button>
                                </div>
                            </Card>
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
            subtitle="2 OF 3 TYPE"
            description={
                <>
                    <p>
                        Generate a secure Multi-Party Computation wallet where the private key is never fully reconstructed.
                    </p>
                </>
            }
        >
            <Card title="Initialize Wallet" className="config-card">
                <p className="config-description">
                    Click below to generate your secure 2-of-3 MPC wallet.
                    This will create 3 distributed shares, of which any 2 are required to sign transactions.
                </p>
                <div className="actions">
                    <Button onClick={handleCreate} disabled={loading} fullWidth className="create-btn">
                        {loading ? (
                            <>Creating Secure Wallet...</>
                        ) : (
                            <>
                                <ShieldCheck size={20} /> Create Wallet
                            </>
                        )}
                    </Button>
                </div>
            </Card>
        </SplitPageLayout>
    );
};

export default WalletCreation;
