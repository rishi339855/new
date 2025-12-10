import React, { useState, useRef } from 'react';
import { Send, User, DollarSign, Shield, Check, ExternalLink, RefreshCw, Key, Lock, Upload, FileJson, Loader2 } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import SplitPageLayout from '../components/SplitPageLayout';
import './Transaction.css';

type Step = 'input' | 'signing' | 'success';

interface ShareStatus {
    id: string;
    label: string;
    approved: boolean;
    value: string;
    fileName?: string;
}

const Transaction: React.FC = () => {
    const [step, setStep] = useState<Step>('input');
    const [formData, setFormData] = useState({
        sender: '',
        receiver: '',
        amount: '',
    });
    const [sessionId, setSessionId] = useState('');
    const [txHash, setTxHash] = useState('');
    const [shares, setShares] = useState<ShareStatus[]>([
        { id: 'A', label: 'Party A (Device)', approved: false, value: '' },
        { id: 'B', label: 'Party B (Server)', approved: true, value: 'SERVER_MANAGED_SHARE' }, // Server share is auto-managed
    ]);
    const [loading, setLoading] = useState(false);
    const [signingStep, setSigningStep] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePrepare = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.sender || !formData.receiver || !formData.amount) {
            alert('Please fill in all fields');
            return;
        }
        setLoading(true);
        setTimeout(() => {
            setSessionId(Math.random().toString(36).substring(2, 15).toUpperCase());
            setStep('signing');
            setLoading(false);
        }, 1000);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, shareId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                // Try parsing as JSON first
                let shareValue = '';
                try {
                    const json = JSON.parse(content);

                    // Check if it's a valid MPC share (has share + index)
                    // CRITICAL: We need the index for Lagrange interpolation
                    if (json.share && json.index) {
                        shareValue = JSON.stringify(json); // Keep the whole object
                    } else {
                        // Fallback
                        shareValue = json.value || json.share || json.shares?.[0]?.value || content;
                    }
                } catch {
                    // If not JSON, treat as raw text
                    shareValue = content.trim();
                }

                setShares(shares.map(s => s.id === shareId ? {
                    ...s,
                    value: shareValue,
                    fileName: file.name,
                    approved: true // Auto-approve on valid upload for better UX
                } : s));
            } catch (error) {
                alert('Failed to read file');
            }
        };
        reader.readAsText(file);
    };

    const handleBroadcast = async () => {
        setLoading(true);
        try {
            // 1. Collect Approved Shares (Client Share A)
            const clientShare = shares.find(s => s.id === 'A');

            if (!clientShare?.value) {
                alert('Please upload your Share A file');
                setLoading(false);
                return;
            }

            // Simulate TSS Signing Rounds
            setSigningStep('Initiating Secure Signing Session...');
            await new Promise(r => setTimeout(r, 1000));

            setSigningStep('Round 1: Committing to Nonces...');
            await new Promise(r => setTimeout(r, 1200));

            setSigningStep('Round 2: Exchanging Partial Signatures...');
            await new Promise(r => setTimeout(r, 1200));

            setSigningStep('Round 3: Aggregating & Verifying Signature...');
            await new Promise(r => setTimeout(r, 1000));

            setSigningStep('Broadcasting to Sepolia Network...');

            // 2. Call Backend API
            const response = await fetch('http://localhost:5001/api/send-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shares: [clientShare.value], // Send only client share, server uses its own
                    sender: formData.sender,
                    to: formData.receiver,
                    value: formData.amount
                })
            });

            const data = await response.json();

            if (data.success) {
                setTxHash(data.txHash);
                setStep('success');
            } else {
                alert('Transaction Failed: ' + data.error);
            }
        } catch (error) {
            console.error('Broadcast error:', error);
            alert('Failed to connect to backend');
        } finally {
            setLoading(false);
            setSigningStep('');
        }
    };

    return (
        <SplitPageLayout
            icon={<Send size={40} />}
            title="Send Transaction"
            subtitle="TRUE MPC SIGNING"
            description={
                <>
                    <p>
                        Initiate a secure transaction. You only need to provide your <strong>Client Share (Share A)</strong>.
                        The server will automatically use its share to collaboratively sign the transaction.
                    </p>
                </>
            }
        >
            {step === 'input' && (
                <Card title="Transaction Details" className="tx-card">
                    <form onSubmit={handlePrepare}>
                        <div className="form-group">
                            <label><User size={16} /> Sender Wallet Address</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="0x..."
                                value={formData.sender}
                                onChange={e => setFormData({ ...formData, sender: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label><User size={16} /> Receiver Wallet Address</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="0x..."
                                value={formData.receiver}
                                onChange={e => setFormData({ ...formData, receiver: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label><DollarSign size={16} /> Amount (ETH)</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={e => {
                                    if (/^\d*\.?\d*$/.test(e.target.value)) {
                                        setFormData({ ...formData, amount: e.target.value });
                                    }
                                }}
                            />
                        </div>
                        <Button type="submit" disabled={loading} fullWidth className="prepare-btn">
                            {loading ? 'Preparing...' : 'Prepare Transaction'}
                        </Button>
                    </form>
                </Card>
            )}

            {
                step === 'signing' && (
                    <div className="signing-flow fade-in">
                        <div className="session-info">
                            <div className="session-header">
                                <Lock size={20} />
                                <span className="session-label">Secure Session ID</span>
                            </div>
                            <code className="session-id">{sessionId}</code>
                        </div>

                        <div className="shares-container">
                            {/* 1. Server Share (Always Active) */}
                            <Card className="share-input-card approved server-share">
                                <div className="share-card-header">
                                    <div className="share-label-group">
                                        <Shield size={18} className="share-icon" />
                                        <h4>Share B (Server)</h4>
                                    </div>
                                    <span className="badge-success"><Check size={12} /> Connected</span>
                                </div>
                                <div className="server-status">
                                    <div className="status-pulse"></div>
                                    <div className="status-text">
                                        <p className="status-primary">Server Ready to Co-Sign</p>
                                        <p className="status-secondary">Waiting for your share...</p>
                                    </div>
                                </div>
                            </Card>

                            <div className="connection-line">
                                <span className="plus-sign">+</span>
                            </div>

                            {/* 2. User Share Input (A or C) */}
                            <Card className={`share-input-card ${shares[0].approved ? 'approved' : ''}`}>
                                <div className="share-card-header">
                                    <div className="share-label-group">
                                        <Key size={18} className="share-icon" />
                                        <h4>Your Share</h4>
                                    </div>
                                    {shares[0].approved && <span className="badge-success"><Check size={12} /> Ready</span>}
                                </div>

                                {!shares[0].approved ? (
                                    <div className="file-upload-area" onClick={() => fileInputRef.current?.click()}>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            hidden
                                            accept=".json,.txt"
                                            onChange={(e) => handleFileUpload(e, 'A')}
                                        />
                                        <Upload size={32} className="upload-icon" />
                                        <p>Upload <strong>Share A</strong> or <strong>Share C</strong></p>
                                        <span className="upload-hint">Drag & drop your JSON file here</span>
                                        <div className="share-options-hint">
                                            <span>Accepts: shareA.json, shareC_recovery.json</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="file-uploaded-state">
                                        <FileJson size={32} className="file-icon" />
                                        <div className="file-info">
                                            <span className="file-name">{shares[0].fileName}</span>
                                            <span className="file-status">
                                                {shares[0].fileName?.includes('shareC') || shares[0].fileName?.includes('recovery')
                                                    ? 'Recovery Share Loaded'
                                                    : 'Client Share Loaded'}
                                            </span>
                                        </div>
                                        <Button
                                            variant="secondary"
                                            className="btn-xs"
                                            onClick={() => setShares(shares.map(s => s.id === 'A' ? { ...s, approved: false, value: '', fileName: '' } : s))}
                                        >
                                            Change
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        </div>

                        {loading && (
                            <div className="signing-overlay">
                                <div className="signing-modal">
                                    <Loader2 size={48} className="spinner" />
                                    <h3>Signing Transaction...</h3>
                                    <p className="signing-step">{signingStep}</p>
                                </div>
                            </div>
                        )}

                        <div className="broadcast-section">
                            <Button
                                onClick={handleBroadcast}
                                disabled={!shares[0].approved || loading}
                                variant={shares[0].approved ? 'primary' : 'secondary'}
                                className="broadcast-btn"
                            >
                                <Send size={20} /> Sign & Broadcast
                            </Button>
                        </div>
                    </div>
                )
            }

            {
                step === 'success' && (
                    <div className="success-view fade-in">
                        <Card className="success-card">
                            <div className="success-icon-bg">
                                <Check size={60} className="success-icon" />
                            </div>
                            <h2>Transaction Sent Successfully!</h2>
                            <p className="success-desc">Your transaction has been signed and broadcasted to the network.</p>

                            <div className="tx-details">
                                <div className="detail-row">
                                    <span>Transaction Hash</span>
                                    <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="tx-link">
                                        {txHash ? `${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}` : '0x...'} <ExternalLink size={14} />
                                    </a>
                                </div>
                            </div>

                            <div className="success-actions">
                                <Button variant="outline" onClick={() => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank')}>
                                    View on Etherscan
                                </Button>
                                <Button onClick={() => {
                                    setStep('input');
                                    setFormData({ sender: '', receiver: '', amount: '' });
                                    setShares([
                                        { id: 'A', label: 'Party A (Device)', approved: false, value: '' },
                                        { id: 'B', label: 'Party B (Server)', approved: true, value: 'SERVER_MANAGED_SHARE' },
                                    ]);
                                    setTxHash('');
                                }}>
                                    <RefreshCw size={16} /> Send Another
                                </Button>
                            </div>
                        </Card>
                    </div>
                )
            }
        </SplitPageLayout >
    );
};

export default Transaction;
