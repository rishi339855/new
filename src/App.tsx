import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import WalletCreation from './pages/WalletCreation';
import CheckBalance from './pages/CheckBalance';
import Transaction from './pages/Transaction';
import TransactionHistory from './pages/TransactionHistory';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<WalletCreation />} />
          <Route path="/balance" element={<CheckBalance />} />
          <Route path="/transaction" element={<Transaction />} />
          <Route path="/history" element={<TransactionHistory />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
