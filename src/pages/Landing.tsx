import { Link } from 'react-router-dom';
import { ArrowRight, CreditCard } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

export default function Landing() {
  return (
    <div className="landing-page">
      <div className="landing-content">
        <div className="landing-header">
          <BrandLogo variant="landing" accentFallback />
          <p className="landing-tagline">
            Track equipment, calibrations, sign-outs, and usage in one place.
          </p>
        </div>
        <div className="landing-actions">
          <Link to="/login?reauth=1" className="btn btn-primary landing-btn">
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
