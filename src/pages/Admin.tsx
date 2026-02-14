/**
 * Admin Panel - INACTIVE
 * When activated, this will provide:
 * - User/site access control
 * - Multi-site management
 * - Equipment manager assignment
 * - Access levels: user, equipment_manager, admin
 * - Contact info auto-population on login
 */
export default function Admin() {
  return (
    <div>
      <div className="page-header">
        <h2>Admin Panel</h2>
        <p style={{ color: 'var(--text-muted)' }}>Coming soon. Admin features are not yet active.</p>
      </div>
      <div className="card">
        <h3 className="card-title">Planned Features</h3>
        <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>Control access to the site</li>
          <li>Manage multiple company sites</li>
          <li>Assign equipment managers to sites</li>
          <li>Assign users to sites (users only see their assigned sites)</li>
          <li>Access levels: User, Equipment Manager, Admin</li>
          <li>Contact info auto-populated when user logs in</li>
        </ul>
      </div>
    </div>
  );
}
