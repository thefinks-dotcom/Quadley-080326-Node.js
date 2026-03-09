import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  ArrowLeft,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Play,
  Loader2,
  FileCode,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Zap,
  Server,
  User,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const STEP_STATUS_STYLES = {
  pass: 'bg-success/10 border-success text-success',
  fail: 'bg-destructive/5 border-destructive/20 text-destructive',
  warning: 'bg-muted border-border text-foreground',
  skip: 'bg-muted border-border text-muted-foreground',
};

const STEP_STATUS_ICONS = {
  pass: <CheckCircle className="h-4 w-4 text-success" />,
  fail: <XCircle className="h-4 w-4 text-destructive" />,
  warning: <AlertTriangle className="h-4 w-4 text-primary" />,
  skip: <Info className="h-4 w-4 text-muted-foreground" />,
};

const SEVERITY_BADGE = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  warning: 'bg-muted text-foreground border-border',
  info: 'bg-muted text-muted-foreground border-border',
};

const SAMLSimulator = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [validationResult, setValidationResult] = useState(null);
  const [testFlowResult, setTestFlowResult] = useState(null);
  const [generatedResponse, setGeneratedResponse] = useState(null);
  const [showXml, setShowXml] = useState(false);

  const [testUser, setTestUser] = useState({
    email: 'testuser@university.edu',
    first_name: 'Test',
    last_name: 'User',
    student_id: 'STU-001',
    department: 'Computer Science',
  });

  const fetchTenants = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/saml-simulator/tenants`);
      setTenants(response.data.tenants || []);
    } catch (error) {
      toast.error('Failed to fetch tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleValidate = async () => {
    if (!selectedTenant) {
      toast.error('Select a tenant first');
      return;
    }
    try {
      setValidating(true);
      setValidationResult(null);
      const response = await axios.post(`${API}/api/saml-simulator/validate/${selectedTenant}`);
      setValidationResult(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleTestFlow = async () => {
    if (!selectedTenant) {
      toast.error('Select a tenant first');
      return;
    }
    try {
      setTesting(true);
      setTestFlowResult(null);
      const response = await axios.post(`${API}/api/saml-simulator/test-flow/${selectedTenant}`, {
        user: testUser,
      });
      setTestFlowResult(response.data);
      toast.success('Test flow completed');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Test flow failed');
    } finally {
      setTesting(false);
    }
  };

  const handleGenerateResponse = async () => {
    if (!selectedTenant) {
      toast.error('Select a tenant first');
      return;
    }
    try {
      setGenerating(true);
      setGeneratedResponse(null);
      const response = await axios.post(
        `${API}/api/saml-simulator/generate-response/${selectedTenant}`,
        { user: testUser }
      );
      setGeneratedResponse(response.data);
      toast.success('SAML Response generated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const selectedTenantData = tenants.find((t) => t.code === selectedTenant);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted p-6 lg:p-8" data-testid="saml-simulator-page">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            data-testid="back-button"
            className="hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight heading-font">
              SAML IdP Simulator
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Test SAML SSO configurations without a live Identity Provider
            </p>
          </div>
        </div>

        {/* Tenant Selector */}
        <Card className="bg-white border border-border shadow-sm rounded-xl" data-testid="tenant-selector-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-foreground text-base">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Select Tenant
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Choose a tenant to test its SAML SSO configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedTenant} onValueChange={(v) => {
              setSelectedTenant(v);
              setValidationResult(null);
              setTestFlowResult(null);
              setGeneratedResponse(null);
            }}>
              <SelectTrigger data-testid="tenant-select" className="h-11 border-border">
                <SelectValue placeholder="Select a tenant..." />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    <span className="flex items-center gap-2">
                      {t.name} ({t.code})
                      {t.has_saml_config && (
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success ml-2">
                          SAML
                        </Badge>
                      )}
                      {!t.sso_enabled && (
                        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border ml-1">
                          SSO Off
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTenantData && (
              <div className="mt-4 flex gap-3 flex-wrap">
                <Badge
                  variant="outline"
                  className={selectedTenantData.sso_enabled
                    ? 'bg-success/10 text-success border-success'
                    : 'bg-muted text-muted-foreground border-border'}
                >
                  SSO: {selectedTenantData.sso_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                  Provider: {selectedTenantData.sso_provider || 'None'}
                </Badge>
                <Badge
                  variant="outline"
                  className={selectedTenantData.has_saml_config
                    ? 'bg-success/10 text-success border-success'
                    : 'bg-muted text-foreground border-border'}
                >
                  SAML Config: {selectedTenantData.has_saml_config ? 'Present' : 'Missing'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test User Configuration */}
        {selectedTenant && (
          <Card className="bg-white border border-border shadow-sm rounded-xl" data-testid="test-user-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <User className="h-4 w-4 text-muted-foreground" />
                Simulated User
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure the test user that will be included in the SAML assertion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm font-medium">Email *</Label>
                  <Input
                    value={testUser.email}
                    onChange={(e) => setTestUser((p) => ({ ...p, email: e.target.value }))}
                    placeholder="user@university.edu"
                    data-testid="test-user-email"
                    className="h-10 border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm font-medium">First Name</Label>
                  <Input
                    value={testUser.first_name}
                    onChange={(e) => setTestUser((p) => ({ ...p, first_name: e.target.value }))}
                    placeholder="Jane"
                    data-testid="test-user-first-name"
                    className="h-10 border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm font-medium">Last Name</Label>
                  <Input
                    value={testUser.last_name}
                    onChange={(e) => setTestUser((p) => ({ ...p, last_name: e.target.value }))}
                    placeholder="Doe"
                    data-testid="test-user-last-name"
                    className="h-10 border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground text-sm font-medium">Student ID</Label>
                  <Input
                    value={testUser.student_id}
                    onChange={(e) => setTestUser((p) => ({ ...p, student_id: e.target.value }))}
                    placeholder="STU-001"
                    data-testid="test-user-student-id"
                    className="h-10 border-border"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-foreground text-sm font-medium">Department</Label>
                  <Input
                    value={testUser.department}
                    onChange={(e) => setTestUser((p) => ({ ...p, department: e.target.value }))}
                    placeholder="Computer Science"
                    data-testid="test-user-department"
                    className="h-10 border-border"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {selectedTenant && (
          <div className="flex flex-wrap gap-3" data-testid="action-buttons">
            <Button
              onClick={handleValidate}
              disabled={validating}
              variant="outline"
              className="h-10 border-border text-foreground hover:bg-muted"
              data-testid="validate-config-btn"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              Validate Config
            </Button>
            <Button
              onClick={handleTestFlow}
              disabled={testing}
              className="h-10 bg-primary hover:bg-primary text-white"
              data-testid="run-test-flow-btn"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Run Test Flow
            </Button>
            <Button
              onClick={handleGenerateResponse}
              disabled={generating}
              variant="outline"
              className="h-10 border-border text-foreground hover:bg-muted"
              data-testid="generate-response-btn"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileCode className="h-4 w-4 mr-2" />}
              Generate SAML Response
            </Button>
          </div>
        )}

        {/* Validation Results */}
        {validationResult && (
          <Card className="bg-white border border-border shadow-sm rounded-xl" data-testid="validation-result-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Configuration Validation
                </CardTitle>
                <Badge
                  variant="outline"
                  className={validationResult.overall_status === 'ready'
                    ? 'bg-success/10 text-success border-success'
                    : 'bg-destructive/5 text-destructive border-destructive/20'}
                  data-testid="validation-status-badge"
                >
                  {validationResult.overall_status === 'ready' ? 'Ready' : 'Incomplete'}
                </Badge>
              </div>
              <CardDescription className="text-muted-foreground">
                {validationResult.tenant_name} ({validationResult.tenant_code})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {validationResult.checks.map((check) => (
                  <div
                    key={check.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      check.passed
                        ? 'bg-success/10/50 border-success/30'
                        : check.severity === 'info'
                        ? 'bg-muted/50 border-border'
                        : 'bg-destructive/5/50 border-destructive/30'
                    }`}
                    data-testid={`check-${check.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {check.passed ? (
                        <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      ) : check.severity === 'info' ? (
                        <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <div>
                        <span className="text-sm font-medium text-foreground">{check.name}</span>
                        <p className="text-xs text-muted-foreground mt-0.5 break-all">{check.detail}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs shrink-0 ml-2 ${SEVERITY_BADGE[check.severity] || ''}`}>
                      {check.severity}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* SP Metadata */}
              {validationResult.sp_metadata && (
                <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
                  <h4 className="text-sm font-medium text-foreground mb-3">SP Metadata (for IdP configuration)</h4>
                  <div className="space-y-2 text-xs">
                    {Object.entries(validationResult.sp_metadata).map(([key, val]) => (
                      <div key={key} className="flex items-start gap-2">
                        <span className="text-muted-foreground font-medium min-w-[100px]">{key}:</span>
                        <code className="text-foreground break-all font-mono">{val}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => copyToClipboard(val)}
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Test Flow Results */}
        {testFlowResult && (
          <Card className="bg-white border border-border shadow-sm rounded-xl" data-testid="test-flow-result-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Zap className="h-4 w-4 text-muted-foreground" />
                SAML Test Flow
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Simulated end-to-end SAML login flow for {testFlowResult.tenant_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Config Issues */}
              {testFlowResult.config_issues.length > 0 && (
                <div className="mb-4 p-3 bg-destructive/5 border border-destructive/30 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-1">Configuration Issues:</p>
                  <ul className="text-xs text-destructive space-y-0.5 list-disc list-inside">
                    {testFlowResult.config_issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Flow Steps */}
              <div className="space-y-3">
                {testFlowResult.flow_steps.map((step) => (
                  <div
                    key={step.step}
                    className={`p-3 rounded-lg border ${STEP_STATUS_STYLES[step.status] || STEP_STATUS_STYLES.skip}`}
                    data-testid={`flow-step-${step.step}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 shrink-0 mt-0.5">
                        <span className="text-xs font-bold w-5 h-5 rounded-full bg-white/80 flex items-center justify-center border">
                          {step.step}
                        </span>
                        {STEP_STATUS_ICONS[step.status]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{step.name}</p>
                        <p className="text-xs mt-0.5 opacity-80 break-all">{step.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* SAML Endpoints */}
              {testFlowResult.saml_endpoints && (
                <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
                  <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Server className="h-3.5 w-3.5" /> SAML Endpoints
                  </h4>
                  <div className="space-y-2 text-xs">
                    {Object.entries(testFlowResult.saml_endpoints).map(([key, val]) => (
                      <div key={key} className="flex items-start gap-2">
                        <span className="text-muted-foreground font-medium min-w-[100px]">{key}:</span>
                        <code className="text-foreground break-all font-mono">{val}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => copyToClipboard(val)}
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Generated SAML Response */}
        {generatedResponse && (
          <Card className="bg-white border border-border shadow-sm rounded-xl" data-testid="generated-response-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <FileCode className="h-4 w-4 text-muted-foreground" />
                  Generated SAML Response
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowXml(!showXml)}
                  className="text-xs text-muted-foreground"
                  data-testid="toggle-xml-btn"
                >
                  {showXml ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  {showXml ? 'Hide' : 'Show'} XML
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Response ID</p>
                  <p className="text-xs font-mono text-foreground truncate mt-0.5">{generatedResponse.response_id}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">NameID</p>
                  <p className="text-xs font-mono text-foreground truncate mt-0.5">{generatedResponse.name_id}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Issue Instant</p>
                  <p className="text-xs font-mono text-foreground truncate mt-0.5">{generatedResponse.issue_instant}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Not On Or After</p>
                  <p className="text-xs font-mono text-foreground truncate mt-0.5">{generatedResponse.not_on_or_after}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg border border-border md:col-span-2">
                  <p className="text-xs text-muted-foreground">ACS URL</p>
                  <p className="text-xs font-mono text-foreground truncate mt-0.5">{generatedResponse.acs_url}</p>
                </div>
              </div>

              {/* Note */}
              <div className="p-3 bg-muted border border-warning/30 rounded-lg mb-4">
                <p className="text-xs text-foreground">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  {generatedResponse.note}
                </p>
              </div>

              {/* XML Display */}
              {showXml && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-xs text-muted-foreground hover:text-muted-foreground z-10"
                    onClick={() => copyToClipboard(generatedResponse.saml_response_xml)}
                    data-testid="copy-xml-btn"
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy XML
                  </Button>
                  <pre
                    className="p-4 bg-primary text-muted rounded-lg text-xs overflow-x-auto font-mono leading-relaxed max-h-[400px] overflow-y-auto"
                    data-testid="saml-xml-display"
                  >
                    {generatedResponse.saml_response_xml}
                  </pre>
                </div>
              )}

              {/* Base64 */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">Base64-encoded SAMLResponse</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => copyToClipboard(generatedResponse.saml_response_base64)}
                    data-testid="copy-base64-btn"
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
                <div className="p-3 bg-muted rounded-lg border border-border max-h-24 overflow-y-auto">
                  <code className="text-xs font-mono text-muted-foreground break-all" data-testid="saml-base64-display">
                    {generatedResponse.saml_response_base64}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SAMLSimulator;
