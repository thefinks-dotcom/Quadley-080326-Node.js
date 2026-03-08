'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Lock, Database, Trash2, Download, FileCheck } from 'lucide-react';

const sections = [
  {
    title: 'Quadley Terms of Service',
    icon: FileCheck,
    items: [
      { heading: '1. Acceptance of Terms', text: 'By registering for an account with Quadley, you agree to be bound by these Terms of Service. Quadley provides a centralized communication and compliance platform for residential colleges.' },
      { heading: '2. Eligibility and Account Security', text: 'Authorized Use: Access is restricted to currently enrolled students and authorized staff of participating residential colleges.\n\nCredential Security: You are responsible for maintaining the confidentiality of your credentials. Administrative accounts (Admins/RAs) are required to use Multi-Factor Authentication (MFA).\n\nInternal Governance: Quadley staff manage internal credentials using enterprise-grade password management (Dashlane) and undergo mandatory background checks.' },
      { heading: '3. Acceptable Use', text: 'Professional Conduct: Users must use the platform for college-related communication, including maintenance requests, dining menus, and event RSVPs.\n\nSafe Disclosure Misuse: The Safe Disclosure module is for legitimate reporting of incidents, including gender-based violence. Providing knowingly false information is a violation of these terms.' },
      { heading: '4. Termination of Access', text: "Access to the platform is typically tied to your status at the residential college. Upon graduation or withdrawal, your account will be deactivated in accordance with your institution's provisioning policy." },
    ],
  },
  {
    title: 'Privacy Policy',
    icon: Shield,
    items: [
      { heading: '1. Information We Collect', text: 'We collect information necessary to facilitate residential life and maintain legislative compliance:\n\n- Identity Data: Name, email address, student ID, and birthday.\n- Residential Data: Room number and floor assignment.\n- Service Data: Late meal requests, maintenance descriptions, and facility bookings.\n- Sensitive Data: Anonymous or identified disclosures regarding safety incidents or gender-based violence.' },
      { heading: '2. How We Use Your Data', text: '- Operational Necessity: To process maintenance requests, display dining menus, and manage billing.\n- Safety and Compliance: To fulfill mandatory reporting obligations under Australian legislation (F2025L01251), including 48-hour risk assessment deadlines.\n- Community Engagement: Facilitating peer recognition (Shoutouts) and floor-level message groups.' },
      { heading: '3. Data Isolation and Multi-Tenancy', text: 'Quadley utilizes a strict multi-tenant architecture. Your data is tagged with a unique tenant_id to ensure it is logically isolated from other residential colleges. Users from one college cannot access or view data belonging to another institution.' },
      { heading: '4. Data Sovereignty and Security', text: '- Hosting: All data is hosted on AWS Sydney (ap-southeast-2) via MongoDB Atlas.\n- Encryption: Data is encrypted at rest using AES-256 (Atlas managed) and in transit via TLS 1.2+.\n- Auditing: The platform undergoes regular security reviews against the OWASP Top 10 vulnerabilities.' },
      { heading: '5. Retention and Your Rights', text: '- Retention: Data is retained for the duration of your enrollment plus a mandatory buffer for audit and financial records (typically 6 years).\n- Right to Deletion: Users may submit a "Request Data Deletion" via the platform. Quadley will process these requests in coordination with the residential college, subject to legal reporting hold requirements.' },
    ],
  },
];

const dataRights = [
  { icon: Download, title: 'Data Export', description: 'Download all your personal data in JSON format.', endpoint: 'GET /api/compliance/export-my-data' },
  { icon: Trash2, title: 'Account Deletion', description: 'Request erasure of your account and personal data.', endpoint: 'POST /api/compliance/delete-my-account' },
  { icon: Lock, title: 'Consent Management', description: 'View and manage your consent preferences.', endpoint: 'GET /api/compliance/consent' },
  { icon: Database, title: 'Data Portability', description: 'Export your data in a machine-readable format.', endpoint: 'GET /api/compliance/export-my-data' },
];

export default function PrivacyTermsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-muted" data-testid="privacy-terms-page">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Legal & Privacy</h1>
        <p className="text-muted-foreground text-sm mb-10">Last updated: February 18, 2026</p>

        {sections.map((section) => (
          <Card key={section.title} className="p-6 mb-6 border border-border bg-white rounded-xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center">
                <section.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
            </div>
            <div className="space-y-5">
              {section.items.map((item) => (
                <div key={item.heading}>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{item.heading}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{item.text}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}

        <Card className="p-6 mb-6 border border-border bg-white rounded-xl">
          <h2 className="text-xl font-semibold text-foreground mb-4">Your Data Rights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dataRights.map((right) => (
              <div key={right.title} className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <right.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{right.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{right.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="text-center mt-8">
          <Button
            variant="outline"
            className="border-border text-muted-foreground"
            onClick={() => router.push('/login')}
            data-testid="back-to-login-btn"
          >
            Back to Login
          </Button>
        </div>
      </div>
    </div>
  );
}
