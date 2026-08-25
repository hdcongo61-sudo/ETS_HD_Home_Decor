# Platform Users - Implementation Summary

## Overview

Implemented a standalone platform user management system for super-admins. Platform users are NOT tied to individual shops/tenants - they are global users who can access the admin panel with specific roles.

## Key Changes

### 1. New Database Model

**File**: `backend/models/platformUserModel.js`

Created a separate `PlatformUser` collection with:
- Independent from tenant users (no tenant relation)
- Bypasses tenant guard (not tenant-scoped)
- Fields: name, email, password, role, permissions, isActive, lastLogin
- 4 predefined roles: `super-admin`, `payment-checker`, `user-manager`, `support`

### 2. Backend API

**Files**:
- `backend/routes/platformUserRoutes.js`
- `backend/controllers/platformUserController.js`

**Endpoints**:
- `GET /api/platform-users` - List all platform users
- `POST /api/platform-users` - Create new platform user
- `PATCH /api/platform-users/:userId` - Update role/status
- `DELETE /api/platform-users/:userId` - Delete user (except super-admins)
- `POST /api/platform-users/send-email` - Send bulk emails

### 3. Frontend UI

**File**: `frontend/src/pages/SuperAdmin.js`

**UsersTab Component**:
- Fetches platform users via API (not from tenant data)
- Role-based filtering (super-admin, payment-checker, user-manager, support)
- Bulk email functionality
- User CRUD operations
- Active/inactive status toggle

**Modals**:
- **AddUserModal**: Create platform users with role selection (no tenant selection)
- **EditUserModal**: Update role and active status
- **EmailUsersModal**: Send emails to selected users

### 4. Role Definitions

| Role | Access Level |
|------|-------------|
| **super-admin** | Full platform access (cannot be deleted) |
| **payment-checker** | Read-only access to billing/payments across all tenants |
| **user-manager** | Can manage platform users |
| **support** | Basic support access |

## API Examples

### Create Platform User
```bash
POST /api/platform-users
{
  "name": "Marie Finance",
  "email": "marie@example.com",
  "password": "SecurePass123!",
  "role": "payment-checker"
}
```

### Update User
```bash
PATCH /api/platform-users/60d5ec49f1b2c8b1f8c4e123
{
  "role": "user-manager",
  "isActive": true
}
```

### Send Email
```bash
POST /api/platform-users/send-email
{
  "userIds": ["60d5ec49f1b2c8b1f8c4e123", "60d5ec49f1b2c8b1f8c4e456"],
  "subject": "Platform Update",
  "message": "Important notification..."
}
```

## Database Structure

### Before (Tenant-embedded users)
```javascript
Tenant {
  _id: ObjectId,
  name: "Shop ABC",
  users: [
    { name: "John", email: "john@shopabc.com", ... }  // Tied to this tenant
  ]
}
```

### After (Platform users)
```javascript
PlatformUser {
  _id: ObjectId,
  name: "Marie Finance",
  email: "marie@platform.com",
  role: "payment-checker",
  permissions: [],
  isActive: true,
  // No tenantId - global user
}
```

## Email Configuration

Add to `.env`:
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM_NAME=ETS HD Home Decor
```

## Frontend Flow

1. Super-admin opens "Utilisateurs" tab
2. Component calls `GET /api/platform-users` on mount
3. Displays list of platform users (not tenant users)
4. Can create, edit, delete platform users
5. Can send bulk emails to selected users

## Security

- All routes require `requireSuperAdmin` middleware
- Passwords hashed with bcrypt before storage
- Super-admins cannot be deleted
- Email BCC for privacy
- Platform users bypass tenant guard (access across all tenants based on role)

## Testing Checklist

- [ ] Create platform user with each role type
- [ ] Update user role and active status
- [ ] Delete non-super-admin user
- [ ] Attempt to delete super-admin (should fail)
- [ ] Send email to multiple users
- [ ] Verify email configuration error handling
- [ ] Filter by role in UI
- [ ] Search by name/email
- [ ] Bulk select and email

## Migration Notes

**Important**: This does NOT affect existing tenant users. Two separate systems coexist:

1. **Tenant Users** (existing): Users who log into shops, stored in `Tenant.users[]`
2. **Platform Users** (new): Global admin users, stored in `PlatformUser` collection

No data migration needed. Existing super-admin can create platform users through the UI.
