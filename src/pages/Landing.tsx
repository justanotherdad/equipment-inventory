import { Link } from 'react-router-dom';
import { Package, ArrowRight, CreditCard } from 'lucide-react';

export default function Landing() {
  return (
    <div className="landing-page">
      <div className="landing-content">
        <div className="landing-header">
          <Package size={48} style={{ color: 'var(--accent)' }} />
          <h1>Equipment Inventory</h1>
          <p className="landing-tagline">
            Track equipment, calibrations, sign-outs, and usage in one place.
          </p>
        </div>
        <div className="landing-actions">
          <Link to="/login" className="btn btn-primary landing-btn">
            Sign in
            <ArrowRight size={18} />
          </Link>
          <Link to="/pricing" className="btn btn-secondary landing-btn">
            <CreditCard size={18} />
            Subscribe / View plans
          </Link>
        </div>
      </div>
    </div>
  );
}
