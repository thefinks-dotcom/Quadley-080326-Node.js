/**
 * Tenant logo mapping for white-label builds.
 * React Native requires static paths for require(), so we map each tenant code
 * to its icon asset here. Add new tenants as they are onboarded.
 */

const TENANT_LOGOS = {
  quadley: require('../../assets/icon.png'),
  grace_college: require('../../assets/tenants/grace_college/icon.png'),
  ormond: require('../../assets/icon.png'),
  murphy_shark: require('../../assets/icon.png'),
};

export default TENANT_LOGOS;
