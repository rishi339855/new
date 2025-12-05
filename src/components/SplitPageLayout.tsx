import React from 'react';
import './SplitPageLayout.css';

interface SplitPageLayoutProps {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    description?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

const SplitPageLayout: React.FC<SplitPageLayoutProps> = ({
    icon,
    title,
    subtitle,
    description,
    children,
    className = '',
}) => {
    return (
        <div className={`split-layout ${className}`}>
            <div className="split-left">
                <div className="split-content-wrapper">
                    <div className="split-icon-wrapper">
                        {icon}
                    </div>
                    <h1 className="split-title">{title}</h1>
                    <p className="split-subtitle">{subtitle}</p>
                    {description && <div className="split-description">{description}</div>}
                </div>
            </div>
            <div className="split-right">
                <div className="split-content-wrapper">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default SplitPageLayout;
