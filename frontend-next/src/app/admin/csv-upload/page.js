'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  FileSpreadsheet,
  Info,
  Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

const CSVUpload = () => {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef(null);
  
  // Determine if accessed from college-admin or super-admin
  const isCollegeAdmin = pathname.includes('college-admin');
  const basePath = isCollegeAdmin ? '/college-admin' : '/admin';
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile) => {
    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }
    setFile(selectedFile);
    setResult(null);
  };

  const downloadTemplate = () => {
    // Create the CSV content directly (no API call needed for template)
    const csvContent = `first_name,last_name,email,role,floor,phone,student_id,birthday
John,Doe,john.doe@college.edu,student,Floor 1,555-123-4567,STU001,15-Jan
Jane,Smith,jane.smith@college.edu,ra,Floor 2,555-234-5678,RA001,20-Mar
Bob,Wilson,bob.wilson@college.edu,student,Floor 1,,,08-Dec
Alice,Brown,alice.brown@college.edu,admin,Floor 3,555-345-6789,ADM001,`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'user_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Template downloaded!');
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    setResult(null);
    setUploadProgress(0);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `${API}/api/user-provisioning/csv-upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        }
      );

      setResult(response.data);

      if (response.data.error_count === 0) {
        toast.success(`Successfully imported ${response.data.success_count} users!`);
      } else {
        toast.warning(`Imported ${response.data.success_count} users with ${response.data.error_count} errors`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload CSV');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setResult(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={() => router.push(isCollegeAdmin ? '/college-admin/users' : '/admin')}
            variant="ghost"
            size="icon"
            className="shrink-0 hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Import Users</h1>
            <p className="text-muted-foreground text-sm mt-1">Bulk import users from a CSV file</p>
          </div>
        </div>

        {/* Instructions Card */}
        <Card className="mb-6 bg-white border border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <Info className="h-5 w-5 text-muted-foreground" />
              How to Import Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Download the CSV template below</li>
              <li>Fill in user information (keep the header row)</li>
              <li>Save and upload the completed file</li>
              <li>Review the import results</li>
            </ol>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" /> Required Fields
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>first_name</strong> - User's first name</li>
                  <li>• <strong>last_name</strong> - User's last name</li>
                  <li>• <strong>email</strong> - Must use college domain</li>
                  <li>• <strong>role</strong> - student, ra, or admin</li>
                  <li>• <strong>floor</strong> - Assigned floor (e.g., Floor 1)</li>
                </ul>
              </div>
              <div className="p-4 bg-muted rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-2">Optional Fields</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>phone</strong> - Contact number</li>
                  <li>• <strong>student_id</strong> - Student ID number</li>
                  <li>• <strong>birthday</strong> - Format: DD-Mon (e.g., 15-Jan)</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={downloadTemplate}
              className="mt-6 flex items-center gap-2 h-10 border-border text-foreground hover:bg-muted"
              variant="outline"
            >
              <Download className="h-4 w-4" />
              Download CSV Template
            </Button>
          </CardContent>
        </Card>

        {/* Upload Area */}
        <Card className="mb-6 bg-white border border-border shadow-sm rounded-xl">
          <CardContent className="pt-6">
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive
                  ? 'border-border bg-muted'
                  : file
                  ? 'border-success bg-success/10'
                  : 'border-border hover:border-border bg-muted'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-4">
                  <div className="inline-flex p-4 bg-success/10 rounded-full">
                    <FileSpreadsheet className="h-10 w-10 text-success" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>

                  {uploading ? (
                    <div className="w-full max-w-xs mx-auto">
                      <Progress value={uploadProgress} className="h-2" />
                      <p className="text-sm text-muted-foreground mt-2">Uploading... {uploadProgress}%</p>
                    </div>
                  ) : (
                    <div className="flex gap-3 justify-center">
                      <Button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="flex items-center gap-2 h-10 bg-primary hover:bg-primary text-white"
                      >
                        <Upload className="h-4 w-4" />
                        Upload & Import
                      </Button>
                      <Button
                        onClick={resetUpload}
                        variant="outline"
                        disabled={uploading}
                        className="h-10 border-border"
                      >
                        Choose Different File
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="inline-flex p-4 bg-muted rounded-full">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">Drop your CSV file here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  </div>
                  <label className="cursor-pointer inline-block">
                    <span className="inline-flex items-center px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground bg-white hover:bg-muted transition-colors">
                      <FileText className="h-4 w-4 mr-2" />
                      Select File
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card className={result.error_count > 0 ? 'border-border' : 'border-success'}>
            <CardHeader className={result.error_count > 0 ? 'bg-muted' : 'bg-success/10'}>
              <CardTitle className="text-lg flex items-center gap-2">
                {result.error_count > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-primary" />
                ) : (
                  <Sparkles className="h-5 w-5 text-success" />
                )}
                Import Results
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-success/10 rounded-lg border border-success">
                  <div className="flex items-center gap-2 text-success mb-1">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">Successful</span>
                  </div>
                  <p className="text-3xl font-bold text-success">{result.success_count}</p>
                </div>

                <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                  <div className="flex items-center gap-2 text-destructive mb-1">
                    <XCircle className="h-5 w-5" />
                    <span className="font-semibold">Errors</span>
                  </div>
                  <p className="text-3xl font-bold text-destructive">{result.error_count}</p>
                </div>
              </div>

              {result.created_users && result.created_users.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-foreground mb-3">Created Users</h3>
                  <div className="bg-muted rounded-lg p-4 max-h-48 overflow-y-auto border">
                    <div className="flex flex-wrap gap-2">
                      {result.created_users.map((email, idx) => (
                        <Badge key={idx} variant="outline" className="bg-white">
                          <CheckCircle className="h-3 w-3 mr-1 text-success" />
                          {email}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    Errors ({result.errors.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.errors.map((error, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-destructive/5 rounded-lg border border-destructive/20 text-sm"
                      >
                        <div className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <div>
                            <span className="font-medium text-destructive">Row {error.row}:</span>
                            <span className="text-destructive ml-1">{error.email}</span>
                            <p className="text-destructive mt-1">{error.error}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t flex gap-3">
                <Button onClick={resetUpload}>
                  Import More Users
                </Button>
                <Button variant="outline" onClick={() => router.push(isCollegeAdmin ? '/college-admin/users' : '/admin/users')}>
                  View All Users
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CSVUpload;
