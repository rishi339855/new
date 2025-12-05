import React, { useState } from 'react';
import { Search, Wallet, ArrowRight, RefreshCw } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import SplitPageLayout from '../components/SplitPageLayout';
import './CheckBalance.css';

const CheckBalance: React.FC = () => {
    const [address, setAddress] = useState('');
    const [balance, setBalance] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCheckBalance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!address) {
            setError('Please enter a wallet address');
            return;
        }
        setError('');
        setLoading(true);
        setBalance(null);

        try {
            const response = await fetch(`http://localhost:5001/api/check-balance?address=${address}`);
            const data = await response.json();

            if (data.success) {
                setBalance(`${data.balanceEth} ETH`);
            } else {
                setError(data.error || 'Failed to fetch balance');
            }
        } catch (err) {
            console.error('Error fetching balance:', err);
            setError('Error connecting to backend');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SplitPageLayout
            icon={<Wallet size={40} />}
            title="Check Balance"
            subtitle="View Wallet Assets"
            description={
                <>
                    <p>
                        Instantly check the balance of any MPC wallet address on the network.
                    </p>
                </>
            }
        >
            <Card className="search-card">
                <form onSubmit={handleCheckBalance}>
                    <div className="form-group">
                        <label htmlFor="address">
                            <Search size={16} /> Wallet Address
                        </label>
                        <div className="input-wrapper">
                            <input
                                id="address"
                                type="text"
                                className="input-field"
                                placeholder="0x..."
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                        </div>
                        {error && <span className="error-text">{error}</span>}
                    </div>
                    <Button type="submit" disabled={loading} fullWidth className="check-btn">
                        {loading ? (
                            <>Fetching Balance...</>
                        ) : (
                            <>
                                Get Balance <ArrowRight size={18} />
                            </>
                        )}
                    </Button>
                </form>
            </Card>

            {balance && (
                <div className="balance-result fade-in">
                    <Card className="balance-card">
                        <div className="balance-content">
                            <span className="balance-label">Current Balance</span>
                            <h1 className="balance-amount">{balance}</h1>
                            <div className="balance-actions">
                                <Button variant="secondary" className="refresh-btn" onClick={handleCheckBalance}>
                                    <RefreshCw size={16} /> Refresh
                                </Button>
                            </div>
                        </div>
                        <div className="balance-bg-icon">
                            <Wallet size={150} />
                        </div>
                    </Card>
                </div>
            )}
        </SplitPageLayout >
    );
};

export default CheckBalance;
