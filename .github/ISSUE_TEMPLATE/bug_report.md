---
name: Bug Report
about: Create a detailed bug report to help improve Precheck.me
title: '[BUG] '
labels: ['bug', 'needs-triage']
assignees: ''
---

<!--
SECURITY NOTICE: 
- DO NOT include any sensitive information, authentication tokens, or PII data
- Sanitize all logs and error messages before posting
- Mask or remove any confidential business data
-->

## Bug Description
### What happened?
<!-- Provide a clear and concise description of the bug -->

### Expected Behavior
<!-- Reference the technical specifications and describe what should have happened -->

### Actual Behavior
<!-- Describe what actually happened with detailed observations -->

### Severity and Impact
**Severity Level:** <!-- Critical/High/Medium/Low -->
**Affected User Roles:** <!-- HR/Candidate/Admin/System -->
**Business Impact:** <!-- Describe the business impact -->
**Performance Impact:** <!-- Include relevant metrics if applicable -->
**Data Integrity Impact:** <!-- Describe any data integrity concerns -->

## Environment
- **Environment:** <!-- Production/Staging/Development -->
- **System Version/Build:** <!-- e.g., v1.2.3-build.456 -->
- **Browser & Version:** <!-- e.g., Chrome 120.0.6099.109 -->
- **Operating System:** <!-- e.g., Windows 11 22H2 -->
- **Screen Resolution:** <!-- e.g., 1920x1080 -->
- **User Role:** <!-- e.g., HR Manager -->
- **Network Config:** <!-- If relevant -->
- **Third-party Status:** <!-- Status of integrated services -->
- **Recent Changes:** <!-- Any recent deployments or changes -->

## Reproduction Steps
1. <!-- Step-by-step guide to reproduce -->
2. <!-- Include all necessary steps -->
3. <!-- Be specific about user actions -->

### Prerequisites
- <!-- List any required test data (sanitized) -->
- <!-- Note configuration requirements -->
- <!-- Specify environment setup needs -->

### Occurrence Pattern
- **Frequency:** <!-- e.g., Always, Intermittent (30% of attempts) -->
- **Timing Pattern:** <!-- e.g., During peak hours, After system idle -->
- **Feature Flags:** <!-- List any relevant feature toggles -->
- **Required Permissions:** <!-- Specify needed access levels -->

## Technical Details
### Error Information
```
<!-- Paste sanitized error messages and codes here -->
```

### Stack Trace
```
<!-- Paste sanitized stack trace here -->
```

### Network Logs
```
<!-- Paste sanitized request/response logs here -->
```

### System State
- **Console Errors:** <!-- List relevant console errors -->
- **Correlation ID:** <!-- Include system correlation ID -->
- **Performance Metrics:** <!-- Include relevant metrics -->
- **Memory Usage:** <!-- Include memory statistics -->
- **Database Logs:** <!-- Include sanitized query logs if applicable -->
- **Service Status:** <!-- List dependency statuses -->

## Initial Verification Checklist
<!-- Mark completed items with an [x] -->
- [ ] Searched for similar issues in current sprint
- [ ] Verified reproducible in isolated environment
- [ ] Checked system status and health metrics
- [ ] Reviewed recent deployments and changes
- [ ] Verified against current documentation
- [ ] Tested in multiple environments if applicable

## Security Impact Checklist
- [ ] Verified no sensitive data in report
- [ ] Checked for security vulnerability implications
- [ ] Confirmed no authentication tokens included
- [ ] Verified no PII data exposure
- [ ] Assessed compliance impact
- [ ] Reviewed access control implications
- [ ] Checked data protection requirements

## Performance Impact Checklist
- [ ] Measured response time impact
- [ ] Checked memory usage patterns
- [ ] Verified database performance impact
- [ ] Assessed network bandwidth usage
- [ ] Evaluated concurrent user impact

<!-- 
Auto-labeling will be applied based on:
- priority-${severity}
- component-${name}
- env-${environment}
- impact-${scope}
- security-${level}
-->

/label ~bug ~needs-triage