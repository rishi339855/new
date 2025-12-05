import React, { useState } from 'react';
import { Send, User, DollarSign, Shield, Check, ExternalLink, RefreshCw, Key, Lock } from 'lucide-react';
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
        { id: 'A', label: 'Party A', approved: false, value: '' },
        { id: 'B', label: 'Party B', approved: false, value: '' },
        { id: 'C', label: 'Party C', approved: false, value: '' },
    ]);
    const [loading, setLoading] = useState(false);

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

    const handleApprove = (id: string) => {
        const share = shares.find(s => s.id === id);
        if (!share?.value) return;

        // Basic Hex Validation
        const hexRegex = /^[0-9a-fA-F]+$/;
        if (!hexRegex.test(share.value)) {
            alert('Invalid Share Format: Must be a hex string');
            return;
        }

        setShares(shares.map(s => s.id === id ? { ...s, approved: true } : s));
    };

    const handleShareInput = (id: string, value: string) => {
        setShares(shares.map(s => s.id === id ? { ...s, value } : s));
    };

    const approvedCount = shares.filter(s => s.approved).length;
    const canBroadcast = approvedCount >= 2;

    const handleBroadcast = async () => {
        setLoading(true);
        try {
            // 1. Collect Approved Shares
            const approvedShares = shares.filter(s => s.approved).map(s => s.value);

            if (approvedShares.length < 2) {
                alert('Need at least 2 approved shares');
                setLoading(false);
                return;
            }

            // 2. Call Backend API
            const response = await fetch('http://localhost:5001/api/send-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shares: approvedShares,
                    sender: formData.sender,
                    to: formData.receiver,
                    value: formData.amount
                })
            });

            const data = await response.json();

            if (data.success) {
                // 3. Success
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
        }
    };

    return (
        <SplitPageLayout
            icon={<Send size={40} />}
            title="Send Transaction"
            subtitle="Secure MPC Signing"
            description={
                <>
                    <p>
                        Initiate and sign transactions using distributed key shares. No single party can sign alone.
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
                            {shares.map(share => (
                                <Card key={share.id} className={`share-input-card ${share.approved ? 'approved' : ''}`}>
                                    <div className="share-card-header">
                                        <div className="share-label-group">
                                            <Key size={18} className="share-icon" />
                                            <h4>{share.label}</h4>
                                        </div>
                                        {share.approved && <span className="badge-success"><Check size={12} /> Approved</span>}
                                    </div>
                                    {!share.approved ? (
                                        <>
                                            <textarea
                                                className="share-textarea"
                                                placeholder={`Paste ${share.label} Share Hex`}
                                                value={share.value}
                                                onChange={e => handleShareInput(share.id, e.target.value)}
                                            />
                                            <Button
                                                onClick={() => handleApprove(share.id)}
                                                disabled={!share.value}
                                                className="approve-btn"
                                                fullWidth
                                            >
                                                <Shield size={16} /> Approve Share
                                            </Button>
                                        </>
                                    ) : (
                                        <div className="approved-state">
                                            <div className="checkmark-circle">
                                                <Check size={32} />
                                            </div>
                                            <p>Share Verified</p>
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>

                        <div className="broadcast-section">
                            <div className="status-indicator">
                                <div className={`status-dot ${approvedCount >= 1 ? 'active' : ''}`}></div>
                                <div className={`status-line ${approvedCount >= 2 ? 'active' : ''}`}></div>
                                <div className={`status-dot ${approvedCount >= 2 ? 'active' : ''}`}></div>
                                <div className={`status-line ${approvedCount >= 3 ? 'active' : ''}`}></div>
                                <div className={`status-dot ${approvedCount >= 3 ? 'active' : ''}`}></div>
                            </div>
                            <p className="status-text">
                                {approvedCount}/3 Shares Approved (Threshold: 2)
                            </p>
                            <Button
                                onClick={handleBroadcast}
                                disabled={!canBroadcast || loading}
                                variant={canBroadcast ? 'primary' : 'secondary'}
                                className="broadcast-btn"
                            >
                                {loading ? 'Broadcasting...' : (
                                    <>
                                        <Send size={20} /> Sign & Broadcast Transaction
                                    </>
                                )}
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
                                    setShares(shares.map(s => ({ ...s, approved: false, value: '' })));
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
