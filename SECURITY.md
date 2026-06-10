# 🔒 Security & Protection Guidelines for HANAMI

## Current Security Features

### 1. **XSS (Cross-Site Scripting) Protection**
- ✅ All user content is escaped using `escapeHtml()` before display
- ✅ HTML entities are converted to prevent malicious code injection
- ✅ User-submitted content cannot execute JavaScript

```javascript
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;  // Safe conversion
}
```

### 2. **SQL Injection Protection**
- ✅ Uses Supabase which implements parameterized queries
- ✅ Never use string concatenation for SQL - always use SDK methods
- ✅ Database access controlled via Supabase API

### 3. **Row-Level Security (RLS)**
- ✅ Supabase RLS policies control who can delete posts
- ✅ Only authorized users can perform delete operations
- ✅ Anonymous users cannot delete others' content

### 4. **Data Validation**
- ✅ Content must not be empty before posting
- ✅ UUID validation ensures only valid post IDs are processed
- ✅ Category selection is restricted to predefined options

### 5. **Timestamp & Audit Trail**
- ✅ All posts have `created_at` timestamp (server-generated)
- ✅ Prevents backdating posts
- ✅ Provides audit trail for accountability

---

## Recommended Security Measures

### For Production Deployment:

1. **Content Security Policy (CSP) Headers**
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://translate.google.com https://cdn.jsdelivr.net
   ```

2. **HTTPS Only**
   - Always deploy with HTTPS
   - Use strict SSL/TLS certificates

3. **CORS Configuration**
   - Configure proper CORS headers in Supabase
   - Restrict API access to authorized domains

4. **Rate Limiting**
   - Implement rate limiting on post submissions
   - Prevent spam/abuse

5. **Input Size Limits**
   - Limit post content to reasonable size (e.g., 5000 characters)
   - Prevent DoS attacks

6. **Regular Backups**
   - Enable Supabase automated backups
   - Store backups securely

---

## Best Practices

✅ **DO:**
- Always escape user input before displaying
- Use environment variables for sensitive config
- Keep dependencies updated
- Monitor database for suspicious activity
- Use strong passwords for admin access

❌ **DON'T:**
- Store passwords in plaintext
- Expose API keys in client code (use env vars)
- Trust user input without validation
- Disable HTTPS in production
- Allow unchecked file uploads

---

## Incident Response

If you suspect a security breach:
1. Review server logs immediately
2. Check Supabase audit logs
3. Isolate affected posts/users
4. Notify users if data was compromised
5. Update security measures

---

## Security Contact

For security issues, contact: HanaMi (owner)

Last Updated: 2026-06-10
