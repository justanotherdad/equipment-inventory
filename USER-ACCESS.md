# User Access & Roles

EquipForge has four user roles. Access is controlled by **role** plus, for Users and Equipment Managers, **site / department / equipment assignments** (`profile_access`).

| Role (code) | Display name | Scope | Primary admin surface |
|-------------|--------------|--------|------------------------|
| `user` | User | Only assigned sites / departments / equipment | — |
| `equipment_manager` | Equipment Manager | Same assignments; more manage actions | **Create User** (Admin route) |
| `company_admin` | Company Admin | Entire company | **Admin** |
| `super_admin` | Super Admin | All companies (platform) | **Platform** |

**Hierarchy:** Super Admin → Company Admin → Equipment Manager → User

---

## Admin vs Platform

| Nav item | Who sees it | Purpose |
|----------|-------------|---------|
| **Admin** | Company Admin (full); Equipment Manager (as “Create User”) | One company’s users, sites, departments, company info |
| **Platform** | Super Admin only | Companies & subscriptions; pick a company to manage its Admin-equivalent tools |

Super Admins do **not** use Admin for multi-company work (`/admin` redirects to `/platform`).

---

## How scoping works

- **User** and **Equipment Manager** only see data for rows in their access assignments (site, optional department, optional equipment). No assignments → no equipment/data.
- **Company Admin** sees everything for their company (`company_id`). They do not use `profile_access` for scoping.
- **Super Admin** sees everything across all companies; on Platform, selecting a company scopes the company-admin panels to that company.

Unauthenticated visitors only see public pages (Landing, Login, Pricing, Reset Password). There is no guest role.

New sign-ups default to **User**, unless the email matches `SUPER_ADMIN_EMAIL` / `ADMIN_EMAIL` (promoted to Super Admin).

---

## 1. User (`user`)

Day-to-day requester and operator within assigned areas.

### Can

- Sign in, change password, sign out
- Use main app pages (except Admin / Platform): Dashboard, Equipment, Request Equipment, Request Queue (**My Requests**), Sign-outs, Calibration Status, Equipment Tested, Download Cal Certs, Equipment Types
- View equipment and related data **only** within assigned access
- Submit equipment requests
- Check out / check in equipment they can see
- View equipment detail, calibration status/certs, and usage within scope

### Cannot

- Open Admin, Create User, or Platform
- Add, import, bulk-edit, or delete equipment
- Approve, reject, or fulfill requests (or see manager notification badges)
- Edit sign-out reservation dates
- Mark equipment out for calibration
- Manage users, roles, sites, departments, company settings, or subscriptions

---

## 2. Equipment Manager (`equipment_manager`)

Manages inventory and requests for assigned sites/departments.

### Can (in addition to User-like access, within assignments)

- Same main pages as User; Admin nav shows as **Create User**
- Create users (typically as User) with access limited to sites the manager already has
- Add / import / bulk-edit / delete equipment (UI)
- Approve, reject, and fulfill requests; edit request line quantities
- Edit active sign-out dates
- Mark equipment out for calibration
- Receive request notification badges

### Cannot

- Full Admin: list/edit all profiles, change roles, manage sites/departments, company settings
- Open **Platform**
- Access sites or data outside their assignments
- Manage other companies or platform subscriptions
- Run company onboarding, payments, or close company

---

## 3. Company Admin (`company_admin`)

Owns configuration and users for **one company**.

### Can

- Full nav including **Admin** (not Platform)
- All equipment, requests, sign-outs, calibration, and related data for their company
- Manage users and roles (User, Equipment Manager, Company Admin), and site/department access
- Create and manage sites and departments
- Edit company info; onboarding wizard; payments / order history
- **Close Company & Delete All Data** (their company)
- All Equipment Manager operational actions (approve/fulfill, cal mark-out, edit sign-out dates, etc.)

### Cannot

- Open **Platform**
- List, create, or delete **other** companies
- Toggle platform subscription settings (Super Admin / Platform only)
- See data for companies other than their own

**Note:** New Company Admins are guided through onboarding until sites exist / onboarding is marked complete.

---

## 4. Super Admin (`super_admin`)

Platform operator across all companies. Primary UI: **Platform** left-nav tab.

### Can

- **Platform:** create / list / delete companies; enable/disable subscription and set plan
- **Platform:** select a company and manage its company info, users, sites, and departments
- Assign any role, including Super Admin; assign users to companies
- All operational inventory capabilities across companies
- See company context on equipment (e.g. company name column)

### Cannot

- Uses **Platform** instead of **Admin** for company administration (`/admin` → `/platform`)

Env bootstrap: matching `SUPER_ADMIN_EMAIL` or legacy `ADMIN_EMAIL` is promoted to Super Admin on login.

---

## Feature matrix

| Feature | User | Equipment Manager | Company Admin | Super Admin |
|---------|:----:|:-----------------:|:-------------:|:-----------:|
| View equipment (scoped) | Assigned | Assigned | Company | All |
| Create / edit / delete equipment | — | ✓ | ✓ | ✓ |
| Request equipment | ✓ | ✓ | ✓ | ✓ |
| See own requests (“My Requests”) | ✓ | — | — | — |
| Approve / reject / fulfill requests | — | ✓ | ✓ | ✓ |
| Sign-out / check-in | ✓ | ✓ | ✓ | ✓ |
| Edit sign-out dates | — | ✓ | ✓ | ✓ |
| Mark out for calibration | — | ✓ | ✓ | ✓ |
| View cal status / download certs | ✓ | ✓ | ✓ | ✓ |
| Equipment Types page | ✓ | ✓ | ✓ | ✓ |
| Create users | — | ✓ (scoped) | ✓ (Admin) | ✓ (Platform) |
| Change roles / access / delete users | — | — | ✓ (Admin) | ✓ (Platform) |
| Manage sites & departments | — | — | ✓ (Admin) | ✓ (Platform) |
| Company info / close company | — | — | ✓ (Admin) | Info via Platform; close is company-admin |
| Multi-company & subscriptions | — | — | — | ✓ (Platform) |
| Request notification badge | — | ✓ | ✓ | ✓ |
| Admin nav | — | Create User | Full | — (use Platform) |
| Platform nav | — | — | — | ✓ |

---

## Who can create which roles

| Creator | Can create |
|---------|------------|
| Equipment Manager | User (UI default; access limited to manager’s sites) |
| Company Admin | User, Equipment Manager, Company Admin |
| Super Admin | User, Equipment Manager, Company Admin, Super Admin |

---

## Related code

- Role type: `src/contexts/AuthContext.tsx`
- Nav / page gates: `src/App.tsx`, `src/pages/Admin.tsx`, `src/pages/Platform.tsx`
- Shared admin UI: `src/components/admin/AdminWorkspace.tsx` (`mode: 'company' | 'platform'`)
- API guards: `server/index.ts` (`adminOnly`, `superAdminOnly`, `companyAdminOnly`, `adminOrEquipmentManager`)
- Data scoping: `server/database.ts` (`profile_access`, company filters)
