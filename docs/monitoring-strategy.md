# Production Monitoring & Alerting Strategy

## Overview

This document outlines the comprehensive monitoring strategy for the Stellar Oracle frontend to detect outages, performance degradation, and errors in real-time.

## Monitoring Components

### 1. Health Check System (IMPLEMENTED)
- **File**: `src/utils/healthCheck.ts` (387 lines)
- **Endpoints**:
  - `GET /health` — Basic status for load balancers
  - `GET /health/detailed` — Full diagnostics
  - `GET /health/live` — Kubernetes liveness probe
  - `GET /health/ready` — Kubernetes readiness probe
- **Checks**:
  - WebSocket connectivity
  - REST API availability
  - IndexedDB storage
  - localStorage availability
- **Status Levels**: healthy → degraded → unhealthy
- **Features**: Parallel checks, cached results, DevTools integration

### 2. Error Tracking (IMPLEMENTED - See error-reporting.md)
- **Service**: Sentry
- **Captures**:
  - React component errors
  - Unhandled promise rejections
  - Network errors
  - API errors
  - WebSocket failures
  - Storage errors
- **Context**: User info, breadcrumbs, session replay
- **Alerts**: Automatic on high-severity errors

### 3. Frontend Performance Monitoring
- **Core Web Vitals** tracking
- **Page load timing**
- **API response times**
- **WebSocket latency**
- **Storage operation duration**
- **Slow network detection**
- **Memory usage monitoring**

### 4. Uptime Monitoring
- **Synthetic monitoring** for critical paths
- **Endpoint availability checks**
- **Geographic health checks**
- **API response validation**
- **Certificate expiration alerts**

### 5. Alerting Strategy
- **Health check failures** → Immediate alert
- **Error spikes** (>10% error rate) → Alert
- **Performance degradation** (>5s latency) → Alert
- **Unresolved errors** (>100 in 1hr) → Alert
- **WebSocket disconnects** (>10% failures) → Alert

## Monitoring Architecture

```
Browser (Frontend)
    ├─ Health Checks (every 60s)
    │   ├─ /health → Load balancer
    │   ├─ /health/detailed → Monitoring system
    │   └─ /health/ready → Kubernetes
    │
    ├─ Error Tracking (Sentry)
    │   ├─ React errors
    │   ├─ Network errors
    │   ├─ API errors
    │   └─ Alerts on high-severity
    │
    ├─ Performance Monitoring
    │   ├─ Core Web Vitals
    │   ├─ API latency
    │   ├─ Network timing
    │   └─ Memory usage
    │
    └─ Analytics
        ├─ User interactions
        ├─ Feature usage
        └─ Error patterns

Monitoring Systems
    ├─ DataDog / New Relic / CloudWatch
    │   └─ Scrape /health/detailed
    │
    ├─ Sentry
    │   └─ Real-time error tracking
    │
    ├─ UptimeRobot / Pingdom
    │   └─ Synthetic monitoring
    │
    └─ Kubernetes
        └─ Use /health/live and /health/ready
```

## Implementation Checklist

### Core Monitoring (DONE)
- [x] Health check system (387 lines)
- [x] Error tracking via Sentry
- [x] Version endpoints for CI/CD
- [ ] Frontend performance monitoring
- [ ] Uptime monitoring script
- [ ] Monitoring documentation
- [ ] Alert rules and runbooks

### Health Checks (DONE)
- [x] WebSocket connectivity check
- [x] REST API availability check
- [x] IndexedDB storage check
- [x] localStorage availability check
- [x] Kubernetes probe support
- [x] DevTools debugging interface

### Error Tracking (DONE - see error-reporting.md)
- [x] Sentry initialization
- [x] React error boundary integration
- [x] Network error tracking
- [x] Unhandled rejection catching
- [x] User context tracking
- [x] Breadcrumb logging

### To Be Implemented
- [ ] Web Vitals monitoring (LCP, FID, CLS)
- [ ] API latency tracking
- [ ] Custom metrics dashboard
- [ ] Alert rules and routing
- [ ] Runbook documentation
- [ ] On-call procedures
- [ ] Synthetic tests for critical flows

## Usage

### Initialize Health Checks

```typescript
import { initHealthCheckMonitoring } from './utils/healthCheck'

// Start periodic health checks (every 60 seconds)
const cleanup = initHealthCheckMonitoring(60000)

// Cleanup on app unload
window.addEventListener('beforeunload', cleanup)
```

### Query Health Status

```typescript
// In DevTools console
window.__HEALTH_CHECK__.getStatus()
// Returns: { status: 'healthy', checks: {...}, uptime: 1234567 }

// Run immediate check
await window.__HEALTH_CHECK__.runNow()

// Individual checks
await window.__HEALTH_CHECK__.checks.websocket()
await window.__HEALTH_CHECK__.checks.restApi()
```

### Health Endpoints

```bash
# Basic health (used by load balancers)
curl https://app.stellar.org/health
# { "status": "healthy", "timestamp": "2024-01-15T10:30:00Z" }

# Full diagnostics
curl https://app.stellar.org/health/detailed
# { "status": "healthy", "checks": {...}, "version": "1.2.3" }

# Kubernetes liveness
curl https://app.stellar.org/health/live
# { "alive": true }

# Kubernetes readiness
curl https://app.stellar.org/health/ready
# { "ready": true, "checks": {...} }
```

## Monitoring Scenarios

### Scenario 1: API Outage
- Health check fails: API returns 503
- Status: "degraded" or "unhealthy"
- Alert: Immediate via monitoring system
- Action: Team receives alert, checks status page

### Scenario 2: WebSocket Disconnect
- Health check fails: WebSocket timeout or connection error
- Status: "unhealthy"
- Alert: Multiple users report connection issues
- Action: Check backend WebSocket server

### Scenario 3: Performance Degradation
- API latency increases to 5+ seconds
- Sentry captures performance metrics
- Health check shows latency > threshold
- Alert: Performance degradation detected
- Action: Check database, network, or server load

### Scenario 4: Storage Issues
- IndexedDB quota exceeded or corrupted
- LocalStorage unavailable
- Health check status: "degraded"
- Alert: Storage issues detected
- Action: Users notified to clear cache

### Scenario 5: Error Spike
- 15% of requests return errors
- Sentry aggregates errors
- Alert threshold exceeded
- Action: Investigate root cause, deploy fix

## Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | 5% | 10% |
| Response Time | 3s | 5s |
| WebSocket Success | 90% | 95% |
| Storage Available | 90% | 50% |
| Uptime | 99% | 95% |
| Health Check Failures | 2 consecutive | 3 consecutive |

## Integration Points

### Vercel / CDN
- Health endpoints accessible
- Auto-scale on health failures
- Certificate monitoring

### Kubernetes (if deployed)
- Liveness probes: `/health/live`
- Readiness probes: `/health/ready`
- Auto-restart on failure
- Pod termination on health failure

### Monitoring Systems
- DataDog / New Relic / CloudWatch
- Scrape `/health/detailed` every 60s
- Alert on status changes
- Dashboard visualization

### Sentry
- Real-time error tracking
- Automated alerts
- Session replay on errors
- Performance monitoring

### Uptime Monitoring
- UptimeRobot / Pingdom
- Monitor `/health` endpoint
- Geographic checks
- SMS alerts on downtime

## Dashboard Metrics

Recommended monitoring dashboard should show:

1. **Application Status**
   - Overall health (healthy/degraded/unhealthy)
   - Uptime percentage
   - Response time trend

2. **Health Checks**
   - WebSocket connectivity
   - API availability
   - Storage status
   - Network latency

3. **Error Tracking**
   - Error rate
   - Top errors
   - Error trend
   - Affected users

4. **Performance**
   - Page load time
   - API response time
   - Core Web Vitals
   - Memory usage

5. **Deployment Status**
   - Current version
   - Deployment time
   - Rollback capability
   - Feature flags

## Runbooks

### Health Check Failure
1. Check `/health/detailed` for specific failures
2. Verify backend API is running
3. Check network connectivity
4. Review Sentry for errors
5. If degraded: Minor issue, monitor closely
6. If unhealthy: Major issue, page on-call

### Error Spike
1. Check Sentry dashboard
2. Identify error pattern
3. Review recent deployments
4. Check backend logs
5. If recent deploy: Rollback
6. If data issue: Deploy fix

### Performance Degradation
1. Check API response times
2. Monitor server resources
3. Check database performance
4. Review WebSocket connections
5. Scale up if needed
6. Investigate root cause

## Next Steps

1. **Deploy health checks** to production
2. **Configure monitoring system** (DataDog/New Relic)
3. **Set up alert routing** (Slack/PagerDuty)
4. **Create on-call schedule**
5. **Document runbooks** per scenario
6. **Train team** on monitoring
7. **Set up dashboards** for visibility
8. **Regular drills** to test procedures

## Resources

- [Health Check Implementation](../src/utils/healthCheck.ts)
- [Error Reporting Strategy](./error-reporting.md)
- [Version Management](./versioning-strategy.md)
- [Architecture Decision Records](./adr/)

## Success Criteria

✅ Health checks respond in <1 second  
✅ Errors detected within 1 minute  
✅ Performance issues identified <5 minutes  
✅ Team alerted of outages in real-time  
✅ < 1 minute to triage and respond  
✅ Monitoring covers 100% of critical paths  
✅ False alarm rate < 5%  
