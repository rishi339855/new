import React, { useState } from 'react';
import { History, Search, ArrowUpRight, ArrowDownLeft, AlertCircle, Clock } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import SplitPageLayout from '../components/SplitPageLayout';
import './TransactionHistory.css';

interface Transaction {
    hash: string;
    to: string;
    from: string;
    value: string;
    timestamp: string;
    status: string;
    fee: string;
    direction: 'In' | 'Out';
    method: string;
}

const TransactionHistory: React.FC = () => {
    const [address, setAddress] = useState('');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const fetchHistory = async () => {
        const cleanAddress = address.trim();
        if (!cleanAddress) return;

        // Basic validation
        if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
            alert('Invalid Ethereum Address format');
            return;
        }

        setLoading(true);
        setSearched(true);
        try {
            const response = await fetch(`http://localhost:5001/api/history?address=${cleanAddress}`);
            const data = await response.json();

            if (data.success) {
                setTransactions(data.data);
                if (data.warning) {
                    alert(data.warning); // Show warning but still display empty/partial data
                }
            } else {
                alert(data.error || 'Failed to fetch history');
            }
        } catch (error) {
            console.error('Error fetching history:', error);
            alert('Error connecting to backend');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SplitPageLayout
            icon={<History size={40} />}
            title="TRANSACTION HISTORY"
            subtitle="ON-CHAIN DATA"
            description={
                <>
                    <p>
                        View detailed historical data for any Sepolia address.
                        Includes gas fees, timestamps, and full transaction status.
                    </p>
                </>
            }
        >
            <Card title="Search Wallet" className="search-card">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Enter Wallet Address (0x...)"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="search-input"
                    />
                    <Button onClick={fetchHistory} disabled={loading || !address} className="search-btn">
                        {loading ? 'Searching...' : <Search size={20} />}
                    </Button>
                </div>
            </Card>

            {searched && (
                <div className="results-section fade-in">
                    {transactions.length > 0 ? (
                        <div className="table-container">
                            <table className="tx-table">
                                <thead>
                                    <tr>
                                        <th>Status</th>
                                        <th>Hash</th>
                                        <th>Method</th>
                                        <th>Time</th>
                                        <th>From / To</th>
                                        <th>Value (ETH)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx) => (
                                        <tr key={tx.hash}>
                                            <td>
                                                <div className={`status-badge ${tx.status.toLowerCase()}`}>
                                                    {tx.status === 'Success' ? (
                                                        tx.direction === 'Out' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />
                                                    ) : <AlertCircle size={14} />}
                                                    <span>{tx.status === 'Success' ? tx.direction : 'Failed'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <a
                                                    href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hash-link"
                                                >
                                                    {tx.hash.substring(0, 10)}...
                                                </a>
                                            </td>
                                            <td><span className="method-badge">{tx.method}</span></td>
                                            <td className="timestamp">{tx.timestamp}</td>
                                            <td>
                                                <div className="address-cell">
                                                    <span className="label">{tx.direction === 'Out' ? 'To:' : 'From:'}</span>
                                                    <span className="addr">
                                                        {tx.direction === 'Out'
                                                            ? `${tx.to.substring(0, 8)}...`
                                                            : `${tx.from.substring(0, 8)}...`}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="value-cell">{parseFloat(tx.value).toFixed(5)} ETH</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <Card className="empty-state">
                            <div className="empty-content">
                                <Clock size={48} className="empty-icon" />
                                <h3>No Transactions Found</h3>
                                <p>This address has no history on the Sepolia Testnet.</p>
                            </div>
                        </Card>
                    )}
                </div>
            )}
        </SplitPageLayout>
    );
};

export default TransactionHistory;
