export const TERMS_LAST_UPDATED = 'February 18, 2026';

export const TERMS_SECTIONS = [
  {
    heading: 'Quadley Terms of Service',
    content: '',
  },
  {
    heading: '1. Acceptance of Terms',
    content:
      'By registering for an account with Quadley, you agree to be bound by these Terms of Service. Quadley provides a centralized communication and compliance platform for residential colleges.',
  },
  {
    heading: '2. Eligibility and Account Security',
    content:
      'Authorized Use: Access is restricted to currently enrolled students and authorized staff of participating residential colleges.\n\nCredential Security: You are responsible for maintaining the confidentiality of your credentials. Administrative accounts (Admins/RAs) are required to use Multi-Factor Authentication (MFA).\n\nInternal Governance: Quadley staff manage internal credentials using enterprise-grade password management (Dashlane) and undergo mandatory background checks.',
  },
  {
    heading: '3. Acceptable Use',
    content:
      'Professional Conduct: Users must use the platform for college-related communication, including maintenance requests, dining menus, and event RSVPs.\n\nSafe Disclosure Misuse: The Safe Disclosure module is for legitimate reporting of incidents, including gender-based violence. Providing knowingly false information is a violation of these terms.',
  },
  {
    heading: '4. Termination of Access',
    content:
      'Access to the platform is typically tied to your status at the residential college. Upon graduation or withdrawal, your account will be deactivated in accordance with your institution\'s provisioning policy.',
  },
  {
    heading: 'Quadley Privacy Policy',
    content: '',
  },
  {
    heading: '1. Information We Collect',
    content:
      'We collect information necessary to facilitate residential life and maintain legislative compliance:\n\n\u2022 Identity Data: Name, email address, student ID, and birthday.\n\u2022 Residential Data: Room number and floor assignment.\n\u2022 Service Data: Late meal requests, maintenance descriptions, and facility bookings.\n\u2022 Sensitive Data: Anonymous or identified disclosures regarding safety incidents or gender-based violence.',
  },
  {
    heading: '2. How We Use Your Data',
    content:
      '\u2022 Operational Necessity: To process maintenance requests, display dining menus, and manage billing.\n\u2022 Safety and Compliance: To fulfill mandatory reporting obligations under Australian legislation (F2025L01251), including 48-hour risk assessment deadlines.\n\u2022 Community Engagement: Facilitating peer recognition (Shoutouts) and floor-level message groups.',
  },
  {
    heading: '3. Data Isolation and Multi-Tenancy',
    content:
      'Quadley utilizes a strict multi-tenant architecture. Your data is tagged with a unique tenant_id to ensure it is logically isolated from other residential colleges. Users from one college cannot access or view data belonging to another institution.',
  },
  {
    heading: '4. Data Sovereignty and Security',
    content:
      '\u2022 Hosting: All data is hosted on AWS Sydney (ap-southeast-2) via MongoDB Atlas.\n\u2022 Encryption: Data is encrypted at rest using AES-256 (Atlas managed) and in transit via TLS 1.2+.\n\u2022 Auditing: The platform undergoes regular security reviews against the OWASP Top 10 vulnerabilities.',
  },
  {
    heading: '5. Retention and Your Rights',
    content:
      '\u2022 Retention: Data is retained for the duration of your enrollment plus a mandatory buffer for audit and financial records (typically 6 years).\n\u2022 Right to Deletion: Users may submit a "Request Data Deletion" via the platform. Quadley will process these requests in coordination with the residential college, subject to legal reporting hold requirements.',
  },
];

export const TERMS_FULL_TEXT = TERMS_SECTIONS
  .map((s) => (s.content ? `${s.heading}\n\n${s.content}` : s.heading))
  .join('\n\n');
