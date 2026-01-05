# 🔧 API Route Refactor: `/api` → `/technical/api`

## 🎯 Objective
Refactor the application so that **all API routes start with `/technical/api` instead of `/api`**, ensuring complete alignment between **backend, frontend, and server configurations**.

This change provides clearer namespace separation and avoids routing conflicts in production.

---

## 1️⃣ Backend Changes

### What to Change
Replace **all backend routes** that start with:

```
/api/*
```

with:

```
/technical/api/*
```

### Files to Update
- Route definitions
- `app.use()` or router mounts
- Middleware path bindings
- Any hardcoded `/api` strings in backend code

### Example
```js
// Before
app.use('/api/users', userRoutes);

// After
app.use('/technical/api/users', userRoutes);
```

---

## 2️⃣ Frontend Changes

### What to Change
Update **all frontend API calls** to use the new base path.

This includes calls made using:
- `fetch`
- `axios`
- Angular `HttpClient`

### Example
```js
// Before
fetch('/api/bulk/sheets');

// After
fetch('/technical/api/bulk/sheets');
```

---

## 3️⃣ Expected Final Routes

All API endpoints must follow this structure:

```
/technical/api/auth/login
/technical/api/users
/technical/api/bulk/sheets
```

No API endpoint should be accessible via `/api/*` after the change.

---

## 4️⃣ Validation Checklist

- [ ] Backend routes updated
- [ ] Frontend API calls updated
- [ ] No remaining `/api` references in codebase
- [ ] Application tested locally
- [ ] Production routing verified

### Quick Test
```bash
curl http://localhost:5000/technical/api/health
```

---

## ✅ Final Result

All frontend and backend API communication now consistently uses:

```
/technical/api
```

This ensures:
- Clean and predictable routing
- Proper namespace separation
- No route conflicts
- Production-ready configuration 🚀
