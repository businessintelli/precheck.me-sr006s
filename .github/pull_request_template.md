# Pull Request Template

## Change Description
### Summary
<!-- Provide a clear and concise description of the changes -->

### Type of Change
- [ ] Feature
- [ ] Bug Fix
- [ ] Refactor
- [ ] Performance
- [ ] Security

### Related Issues
<!-- Link related issues using #issue_number -->
Fixes #

### Breaking Changes
<!-- List any breaking changes and migration steps required -->

### System Impact
<!-- Describe impact on system components and cross-team dependencies -->

### Dependencies
<!-- List any new or modified dependencies -->

## Technical Details
### Components Affected
<!-- List all components modified by this change -->

### Database Changes
<!-- Detail any schema changes, migrations, or data updates -->
- [ ] Schema changes required
- [ ] Migration scripts provided
- [ ] Rollback scripts tested

### API Impact
<!-- Document any API changes or version updates -->
- [ ] API version updated
- [ ] Backward compatibility maintained
- [ ] API documentation updated

### Configuration Updates
<!-- List any configuration or environment variable changes -->

### Performance Impact
<!-- Document performance metrics and resource utilization changes -->
- [ ] Performance benchmarks completed
- [ ] Resource utilization assessed
- [ ] Load testing performed

## Security Considerations
### Security Assessment
<!-- Document security impact and measures implemented -->
- [ ] Security impact analyzed
- [ ] Vulnerability scanning completed
- [ ] Security testing performed

### Data Protection
<!-- Detail data protection measures and compliance requirements -->
- [ ] PII handling verified
- [ ] Data encryption implemented
- [ ] GDPR compliance maintained

## Testing Documentation
### Test Coverage
- [ ] Unit tests added/updated
- [ ] Integration tests completed
- [ ] E2E tests performed
- [ ] Cross-browser testing done
- [ ] Mobile responsiveness verified

### Test Results
<!-- Provide summary of test results and coverage metrics -->

## Monitoring & Observability
### Monitoring Updates
- [ ] APM instrumentation added
- [ ] Logging implemented
- [ ] Metrics collection configured
- [ ] Alerts defined
- [ ] Dashboards updated

## Deployment Strategy
### Deployment Plan
<!-- Detail deployment steps and requirements -->
- [ ] Deployment steps documented
- [ ] Environment variables configured
- [ ] Migration procedures tested
- [ ] Rollback plan verified
- [ ] Health checks updated

## Review Checklist
### Code Quality
- [ ] Follows coding standards
- [ ] Documentation complete
- [ ] Type definitions updated
- [ ] Error handling implemented
- [ ] Code comments added
- [ ] Technical debt addressed

### Testing Verification
- [ ] All tests passing
- [ ] Performance requirements met
- [ ] Security requirements satisfied
- [ ] Cross-browser compatibility verified
- [ ] Mobile testing completed

### Security Compliance
- [ ] No sensitive data exposed
- [ ] Input validation implemented
- [ ] Authentication verified
- [ ] Authorization rules tested
- [ ] Encryption requirements met
- [ ] Dependencies scanned
- [ ] Security best practices followed

### Performance & Scalability
- [ ] Performance impact acceptable
- [ ] Database queries optimized
- [ ] Caching implemented
- [ ] Bundle size verified
- [ ] Load testing passed
- [ ] Resource utilization acceptable

### Deployment Readiness
- [ ] Migration scripts ready
- [ ] Rollback procedures documented
- [ ] Environment configuration complete
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Documentation updated

## Additional Notes
<!-- Add any additional information or context -->

## Screenshots
<!-- If applicable, add screenshots to help explain your changes -->

## Reviewer Notes
<!-- Special instructions for reviewers -->

---
<!-- Do not modify below this line -->
/label ~"status-review" ~"type-${change_type}" ~"component-${name}" ~"priority-${level}" ~"impact-${scope}"