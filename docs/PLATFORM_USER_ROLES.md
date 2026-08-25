# Platform User Roles & Permissions

## Overview

The super-admin panel now supports creating platform users with specialized roles and permissions. This allows delegating specific administrative tasks without granting full super-admin access.

## Features

### 1. Role-Based Access Control

Two specialized permissions can be assigned to users:

- **Payment Checker** (`payment-checker`)
  - Read-only access to billing and payment information
  - Can view subscription status, payment history, and overdue accounts
  - Cannot modify tenant settings or billing data
  - Use case: Finance team member who monitors payment status

- **User Manager** (`user-manager`)
  - Can view and manage users across all tenants
  - Can create new users and assign roles
  - Cannot access billing or other sensitive platform data
  - Use case: HR or support team member who handles user access

### 2. User Management UI

Located in **Super Admin → Utilisateurs** tab:

- **Search & Filters**: Search by name/email, filter by role or tenant status
- **Bulk Selection**: Select multiple users with checkboxes
- **Add User**: Create new users with role and permission assignment
- **Edit Permissions**: Update user permissions after creation
- **Email Communication**: Send emails to selected users

### 3. Email Communication

Super-admins can send emails to platform users:

1. Select users using checkboxes in the Users tab
2. Click "Email (N)" button
3. Compose subject and message
4. Send to all selected users via BCC (privacy-preserving)

## API Endpoints

### Create Platform User
```
POST /api/platform-users
Authorization: Bearer <super-admin-token>

{
  "name": "Jean Dupont",
  "email": "jean@example.com",
  "password": "secure-password",
  "tenantId": "507f1f77bcf86cd799439011",
  "role": "admin",
  "permissions": ["payment-checker"]
}
```

### Update User Permissions
```
PATCH /api/platform-users/:tenantId/:userId/permissions
Authorization: Bearer <super-admin-token>

{
  "permissions": ["payment-checker", "user-manager"]
}
```

### Send Email to Users
```
POST /api/platform-users/send-email
Authorization: Bearer <super-admin-token>

{
  "users": [
    { "tenantId": "...", "userId": "..." },
    { "tenantId": "...", "userId": "..." }
  ],
  "subject": "Important Update",
  "message": "Your message here..."
}
```

## Email Configuration

Email functionality requires SMTP configuration in `.env`:

```bash
# SMTP Settings
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM_NAME=ETS HD Home Decor
```

### Gmail Setup

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password in `EMAIL_PASS` (not your regular password)

### Other SMTP Providers

- **SendGrid**: Set `EMAIL_HOST=smtp.sendgrid.net`, use API key as password
- **Mailgun**: Set `EMAIL_HOST=smtp.mailgun.org`, use SMTP credentials
- **AWS SES**: Set `EMAIL_HOST=email-smtp.region.amazonaws.com`, use SMTP credentials

## Security Considerations

1. **Permission Checking**: All platform user routes require super-admin authentication
2. **Password Hashing**: User passwords are hashed with bcrypt before storage
3. **BCC Emails**: Recipients are hidden from each other for privacy
4. **Tenant Isolation**: Users can only be created within existing tenants
5. **Valid Permissions**: Only predefined permissions are accepted

## Usage Examples

### Scenario 1: Finance Team Access

Create a user who only monitors payments:

```javascript
{
  "name": "Marie Finance",
  "email": "marie@finance.example.com",
  "password": "SecurePass123!",
  "tenantId": "...",
  "role": "user",
  "permissions": ["payment-checker"]
}
```

### Scenario 2: Support Team Access

Create a user who manages user accounts:

```javascript
{
  "name": "Support Agent",
  "email": "support@example.com",
  "password": "SecurePass123!",
  "tenantId": "...",
  "role": "user",
  "permissions": ["user-manager"]
}
```

### Scenario 3: Dual Role

Create a user with both permissions:

```javascript
{
  "name": "Operations Manager",
  "email": "ops@example.com",
  "password": "SecurePass123!",
  "tenantId": "...",
  "role": "admin",
  "permissions": ["payment-checker", "user-manager"]
}
```

## Permissions in User Model

The `permissions` field is stored as an array in the User subdocument:

```javascript
{
  _id: ObjectId("..."),
  name: "Jean Dupont",
  email: "jean@example.com",
  isAdmin: false,
  permissions: ["payment-checker", "user-manager"],
  createdAt: ISODate("2026-08-24T...")
}
```

## Future Enhancements

Potential additions for future iterations:

- **Granular Permissions**: More fine-grained access control (e.g., `billing.read`, `billing.write`)
- **Permission Middleware**: Route-level permission checking in backend
- **UI Visibility**: Hide/show UI elements based on user permissions
- **Audit Logs**: Track permission changes and sensitive actions
- **Role Templates**: Predefined role bundles for common use cases
- **Multi-Tenant Users**: Users that can access multiple tenants
