import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, CreditCard, Send, History, Shield } from 'lucide-react';
import './Navbar.css';

const Navbar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="logo">
          <Shield className="logo-icon" size={28} />
          <span>MPC Wallet</span>
        </Link>
        <div className="nav-links">
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
            <Wallet size={18} />
            <span>Create</span>
          </Link>
          <Link to="/balance" className={`nav-link ${isActive('/balance') ? 'active' : ''}`}>
            <CreditCard size={18} />
            <span>Balance</span>
          </Link>
          <Link to="/transaction" className={`nav-link ${isActive('/transaction') ? 'active' : ''}`}>
            <Send size={18} />
            <span>Send</span>
          </Link>
          <Link to="/history" className={`nav-link ${isActive('/history') ? 'active' : ''}`}>
            <History size={18} />
            <span>History</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
