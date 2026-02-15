import { Link } from 'react-router-dom';
import { Check, X, Package, ArrowLeft } from 'lucide-react';

const tiers = [
  {
    name: 'Level 1',
    price: '$0',
    period: 'forever',
    description: 'Ideal for small teams',
    features: [
      '1 site',
      '2 departments per site',
      '2 equipment managers',
      'Up to 20 users',
    ],
    excluded: ['Multiple sites', 'Advanced reporting'],
    cta: 'Create Account',
    highlight: false,
  },
  {
    name: 'Level 2',
    price: '$0',
    period: 'forever',
    description: 'For growing teams',
    features: [
      '2 sites',
      '4 departments per site',
      '3 equipment managers',
      'Up to 50 users',
    ],
    excluded: ['Enterprise support'],
    cta: 'Create Account',
    highlight: true,
  },
  {
    name: 'Level 3',
    price: '$0',
    period: 'forever',
    description: 'For larger organizations',
    features: [
      '5 sites',
      '3 departments per site',
      '10 equipment managers',
      'Up to 200 users',
    ],
    excluded: [],
    cta: 'Create Account',
    highlight: false,
  },
  {
    name: 'Level 4',
    price: '$0',
    period: 'forever',
    description: 'Enterprise',
    features: [
      '10 sites',
      '5 departments per site',
      '20 equipment managers',
      'Up to 500 users',
    ],
    excluded: [],
    cta: 'Create Account',
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <div className="pricing-page">
      <Link to="/" className="pricing-back">
        <ArrowLeft size={18} />
        Back
      </Link>
      <div className="pricing-header">
        <h1>Simple Pricing</h1>
        <p className="pricing-subtitle">All plans are free during launch.</p>
      </div>
      <div className="pricing-grid">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`pricing-card ${tier.highlight ? 'pricing-card-highlight' : ''}`}
          >
            {tier.highlight && (
              <div className="pricing-badge">POPULAR</div>
            )}
            <h3 className="pricing-tier-name">{tier.name}</h3>
            <p className="pricing-description">{tier.description}</p>
            <div className="pricing-price">
              <span className="pricing-amount">{tier.price}</span>
              <span className="pricing-period">/{tier.period}</span>
            </div>
            <ul className="pricing-features">
              {tier.features.map((f) => (
                <li key={f}>
                  <Check size={18} className="pricing-check" />
                  {f}
                </li>
              ))}
              {tier.excluded.map((f) => (
                <li key={f} className="pricing-excluded">
                  <X size={18} className="pricing-x" />
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/login" className={`btn ${tier.highlight ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}>
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
