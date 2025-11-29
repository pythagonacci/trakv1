# 🧪 Production Performance Testing Guide

## Quick Commands

```bash
# Test production build locally (most accurate)
npm run build && npm start

# Or use the new shortcut
npm run test:prod

# Analyze bundle sizes
npm run build
```

---

## 📊 **Method 1: Local Production Build** (Recommended)

This simulates **exactly** what users will experience in production.

### Step 1: Build for Production
```bash
npm run build
```

**What to look for:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (X/Y)
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    1.2 kB    100 kB
├ ○ /dashboard                           5.8 kB    150 kB
└ ○ /dashboard/projects                  8.4 kB    165 kB

○  (Static)  prerendered as static content
```

**Good Signs**:
- ✅ Build completes in < 60 seconds
- ✅ Most pages are "Static" (○)
- ✅ First Load JS < 200 kB per page
- ✅ No warnings or errors

### Step 2: Start Production Server
```bash
npm start
```

Server runs on http://localhost:3000

### Step 3: Test in Browser
1. Open **Chrome DevTools** (F12)
2. Go to **Network** tab
3. Check "Disable cache"
4. Navigate through your app
5. Watch the metrics

**What to look for**:
- ✅ **Initial page load**: < 2 seconds
- ✅ **JavaScript bundles**: < 200 KB gzipped
- ✅ **Page navigation**: < 500ms
- ✅ **No console errors**

---

## 🚦 **Method 2: Lighthouse Performance Test**

### Option A: Chrome DevTools Lighthouse

1. Build and start production server:
```bash
npm run build && npm start
```

2. Open http://localhost:3000 in **Chrome**

3. Open DevTools (F12) → **Lighthouse** tab

4. Configure test:
   - ✅ Performance
   - ✅ Desktop or Mobile
   - Click **Analyze page load**

5. Wait for results (30-60 seconds)

**Target Scores**:
- 🎯 **Performance**: 90+ (Excellent)
- 🎯 **Accessibility**: 90+
- 🎯 **Best Practices**: 90+
- 🎯 **SEO**: 90+

### Option B: Command Line Lighthouse

```bash
# Install lighthouse globally (if not already)
npm install -g lighthouse

# Run production server
npm run build && npm start

# In another terminal, run lighthouse
lighthouse http://localhost:3000 --view
```

This opens a detailed HTML report showing:
- ⚡ **First Contentful Paint** (FCP)
- ⚡ **Largest Contentful Paint** (LCP)
- ⚡ **Time to Interactive** (TTI)
- ⚡ **Total Blocking Time** (TBT)
- ⚡ **Cumulative Layout Shift** (CLS)

---

## 📦 **Method 3: Analyze Bundle Sizes**

See exactly what's being shipped to users.

### Check Build Output
```bash
npm run build
```

Look at the output table:
```
Route (app)                              Size     First Load JS
┌ ○ /                                    1.2 kB    100 kB
├ ○ /dashboard                           5.8 kB    150 kB
└ ƒ /dashboard/projects/[id]             12 kB     180 kB
```

**Legend**:
- `○` = Static (pre-rendered at build time) ✅ GOOD
- `ƒ` = Dynamic (rendered on-demand) ⚠️ OK
- `λ` = Server-side rendered on every request ❌ SLOWER

### Inspect Bundle Files
```bash
# After build, check the actual files
ls -lh .next/static/chunks/

# See total size
du -sh .next/
```

**Benchmarks**:
- ✅ **Total .next/ size**: < 50 MB
- ✅ **Main bundle**: < 150 KB
- ✅ **Page bundles**: < 50 KB each

---

## ⚡ **Method 4: Real Performance Monitoring**

### Using Browser Performance API

Add this to any page to measure load times:

```typescript
// In your page component or layout
useEffect(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      const perfData = window.performance.getEntriesByType('navigation')[0];
      console.log('Page Load Metrics:', {
        DNS: perfData.domainLookupEnd - perfData.domainLookupStart,
        TCP: perfData.connectEnd - perfData.connectStart,
        Request: perfData.responseStart - perfData.requestStart,
        Response: perfData.responseEnd - perfData.responseStart,
        DOM: perfData.domComplete - perfData.domLoading,
        Total: perfData.loadEventEnd - perfData.fetchStart,
      });
    });
  }
}, []);
```

---

## 📈 **Before/After Comparison**

### Test Workflow

1. **Baseline (Before optimizations)**:
```bash
git stash  # Save current changes
git checkout HEAD~10  # Go back before optimizations
npm install
npm run build
# Note the build time and bundle sizes
npm start
# Run Lighthouse, note scores
```

2. **After optimizations**:
```bash
git stash pop  # Restore changes
npm install
npm run build
# Compare build time and bundle sizes
npm start
# Run Lighthouse, compare scores
```

---

## 🎯 **Target Performance Metrics**

### Build Time
- ✅ **Initial build**: < 60 seconds
- ✅ **Incremental build**: < 10 seconds

### Bundle Sizes (Gzipped)
- ✅ **Main bundle**: < 150 KB
- ✅ **Page chunks**: < 50 KB each
- ✅ **Total JS**: < 500 KB

### Runtime Performance
- ✅ **First Load**: < 2 seconds
- ✅ **Page Navigation**: < 500ms
- ✅ **Time to Interactive**: < 3 seconds

### Lighthouse Scores
- ✅ **Performance**: 90-100
- ✅ **First Contentful Paint**: < 1.8s
- ✅ **Largest Contentful Paint**: < 2.5s
- ✅ **Total Blocking Time**: < 200ms

---

## 🔍 **Troubleshooting Slow Production Build**

### Issue: Build takes > 2 minutes
```bash
# Check what's being compiled
npm run build -- --debug

# Clear cache and rebuild
rm -rf .next node_modules/.cache
npm run build
```

### Issue: Large bundle sizes
```bash
# Install bundle analyzer
npm install -D @next/bundle-analyzer

# Update next.config.ts
# (See example below)

# Run analysis
ANALYZE=true npm run build
```

### Issue: Slow page loads
1. Check Network tab for large resources
2. Use Lighthouse to identify bottlenecks
3. Check if images are optimized
4. Verify code splitting is working

---

## 📊 **Advanced: Bundle Analyzer Setup**

Add to `next.config.ts`:

```typescript
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // ... your existing config
});
```

Then run:
```bash
npm install -D @next/bundle-analyzer
ANALYZE=true npm run build
```

This opens an interactive visualization showing:
- 📦 What's in each bundle
- 📊 Size of each dependency
- 🎯 Optimization opportunities

---

## ✅ **Quick Checklist**

Before deploying to production:

- [ ] Run `npm run build` successfully
- [ ] Start production server with `npm start`
- [ ] Test key user flows
- [ ] Run Lighthouse (score > 90)
- [ ] Check bundle sizes (< 500KB total)
- [ ] Test on slow 3G network
- [ ] Test on mobile device
- [ ] Check console for errors
- [ ] Verify all images load
- [ ] Test authentication flow

---

## 🚀 **Production Deployment Testing**

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy preview
vercel

# Test the preview URL
# Check performance
```

### Other Platforms
- Deploy to staging environment first
- Run smoke tests
- Monitor performance metrics
- Check error logs

---

## 📝 **Performance Monitoring in Production**

Consider adding:
- **Vercel Analytics** (built-in if using Vercel)
- **Google Analytics 4** with Web Vitals
- **Sentry** for error tracking
- **LogRocket** for session replay

---

## 🎉 **Expected Results After Optimizations**

With all the performance fixes applied, you should see:

### Development (npm run dev)
- ⚡ HMR: ~100-300ms (was 3-5s)
- ⚡ Page navigation: Near instant
- ⚡ Type-checking: ~5s (was ~8s)

### Production (npm run build && npm start)
- ⚡ Build time: ~40s (was ~60s)
- ⚡ Bundle size: ~300KB (was ~500KB)
- ⚡ Lighthouse score: 90+ (was ~70)
- ⚡ First load: < 2s (was ~4s)

---

**Remember**: Production is **MUCH faster** than development because:
- ✅ Code is minified
- ✅ Dead code eliminated
- ✅ React optimizations applied
- ✅ Static pages pre-rendered
- ✅ Aggressive caching enabled

