'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Download,
  FileText,
  Mail,
  BarChart3,
  RefreshCw,
  Users,
  Calendar,
  Megaphone,
  Award,
  Wrench,
  Users2,
  TrendingUp,
  Clock,
  Star,
  FileSpreadsheet,
  Eye
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

const ReportsInsights = () => {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [showDigestPreview, setShowDigestPreview] = useState(false);

  useEffect(() => {
    fetchReportsData();
  }, []);

  const fetchReportsData = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/dashboard/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch reports', error);
      toast.error('Failed to load reports data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const exportToCSV = async (module, label) => {
    setExporting(module);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/dashboard/export/${module}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const items = response.data.data;
      if (!items || items.length === 0) {
        toast.error('No data to export');
        return;
      }
      
      // Convert to CSV
      const headers = Object.keys(items[0]);
      const csvContent = [
        headers.join(','),
        ...items.map(item => 
          headers.map(h => {
            let val = item[h];
            if (val === null || val === undefined) val = '';
            if (typeof val === 'object') val = JSON.stringify(val);
            // Escape quotes and wrap in quotes if contains comma
            val = String(val).replace(/"/g, '""');
            if (val.includes(',') || val.includes('\n') || val.includes('"')) {
              val = `"${val}"`;
            }
            return val;
          }).join(',')
        )
      ].join('\n');
      
      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${module}_export_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success(`${label} exported successfully!`);
    } catch (error) {
      console.error('Export error', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(null);
    }
  };

  const getHeatmapColor = (value, max) => {
    if (value === 0) return 'bg-muted';
    const intensity = Math.min(value / max, 1);
    if (intensity < 0.25) return 'bg-muted';
    if (intensity < 0.5) return 'bg-primary';
    if (intensity < 0.75) return 'bg-primary';
    return 'bg-primary';
  };

  const exportModules = [
    { id: 'users', label: 'Users', icon: Users, color: 'text-muted-foreground' },
    { id: 'events', label: 'Events', icon: Calendar, color: 'text-primary' },
    { id: 'announcements', label: 'Announcements', icon: Megaphone, color: 'text-primary' },
    { id: 'groups', label: 'Co-curricular Groups', icon: Users2, color: 'text-primary' },
    { id: 'service_requests', label: 'Service Requests', icon: Wrench, color: 'text-primary' },
    { id: 'recognitions', label: 'Recognitions', icon: Award, color: 'text-primary' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-muted">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/college-admin')} variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Reports & Insights</h1>
              <p className="text-muted-foreground text-sm">Export data, preview digests, and view analytics</p>
            </div>
          </div>
          <Button onClick={fetchReportsData} variant="outline" disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Export to CSV Section */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Download className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Export Data to CSV</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Download complete data from any module as a CSV file.</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {exportModules.map(mod => (
                <button
                  key={mod.id}
                  onClick={() => exportToCSV(mod.id, mod.label)}
                  disabled={exporting === mod.id}
                  className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted hover:border-border transition-all disabled:opacity-50"
                >
                  <mod.icon className={`h-6 w-6 ${mod.color}`} />
                  <span className="text-sm font-medium text-foreground">{mod.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {data?.export_counts?.[mod.id] || 0} records
                  </span>
                  {exporting === mod.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-success" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Digest Preview */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Weekly Digest Preview</h2>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowDigestPreview(!showDigestPreview)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showDigestPreview ? 'Hide' : 'Preview'}
              </Button>
            </div>
            
            {showDigestPreview && data?.weekly_digest && (
              <div className="border rounded-lg p-6 bg-white">
                {/* Email Header */}
                <div className="text-center border-b pb-4 mb-4">
                  <h3 className="text-xl font-bold text-foreground">📊 Weekly College Update</h3>
                  <p className="text-sm text-muted-foreground">{data.weekly_digest.period}</p>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-primary">{data.weekly_digest.messages_sent}</p>
                    <p className="text-xs text-primary">Messages Sent</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-primary">{data.weekly_digest.recognitions_given}</p>
                    <p className="text-xs text-foreground">Recognitions</p>
                  </div>
                  <div className="text-center p-3 bg-success/10 rounded-lg">
                    <p className="text-2xl font-bold text-success">{data.weekly_digest.new_users}</p>
                    <p className="text-xs text-success">New Users</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-primary">{data.weekly_digest.requests_resolved}</p>
                    <p className="text-xs text-primary">Requests Resolved</p>
                  </div>
                </div>
                
                {/* Top Recognized */}
                {data.weekly_digest.top_recognized?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      Top Recognized This Week
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {data.weekly_digest.top_recognized.map((person, idx) => (
                        <Badge key={idx} className={`${idx === 0 ? 'bg-muted text-foreground' : 'bg-muted text-foreground'}`}>
                          {idx === 0 && '🏆 '}{person.name || 'Unknown'} ({person.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Upcoming Events */}
                {data.weekly_digest.events_upcoming?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      Upcoming Events
                    </h4>
                    <div className="space-y-2">
                      {data.weekly_digest.events_upcoming.slice(0, 5).map((event, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground w-20">
                            {event.date?.slice(5, 10)}
                          </div>
                          <span className="text-sm font-medium">{event.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Recent Announcements */}
                {data.weekly_digest.announcements?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-primary" />
                      Recent Announcements
                    </h4>
                    <div className="space-y-2">
                      {data.weekly_digest.announcements.slice(0, 3).map((ann, idx) => (
                        <div key={idx} className="p-2 bg-muted rounded">
                          <span className="text-sm font-medium">{ann.title}</span>
                          <Badge className="ml-2 text-xs">{ann.target_audience}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {!showDigestPreview && (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p>Click "Preview" to see what the weekly digest email would look like</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Engagement Heatmap */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Engagement Heatmap</h2>
              <span className="text-xs text-muted-foreground ml-2">Last 30 days</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Message activity by day and hour. Darker = more activity.</p>
            
            {data?.heatmap && (
              <div className="overflow-x-auto">
                {/* Hour labels */}
                <div className="flex mb-1 ml-12">
                  {Array.from({length: 24}, (_, i) => (
                    <div key={i} className="w-6 text-center text-xs text-muted-foreground">
                      {i % 3 === 0 ? `${i}` : ''}
                    </div>
                  ))}
                </div>
                
                {/* Heatmap grid */}
                <div className="space-y-1">
                  {data.heatmap.data.map((row, dayIdx) => (
                    <div key={dayIdx} className="flex items-center">
                      <div className="w-12 text-xs text-muted-foreground font-medium">
                        {data.heatmap.days[dayIdx]}
                      </div>
                      <div className="flex gap-[2px]">
                        {row.map((value, hourIdx) => (
                          <div
                            key={hourIdx}
                            className={`w-6 h-6 rounded-sm ${getHeatmapColor(value, data.heatmap.max_value)} cursor-pointer transition-transform hover:scale-110`}
                            title={`${data.heatmap.days[dayIdx]} ${hourIdx}:00 - ${value} messages`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 justify-center">
                  <span className="text-xs text-muted-foreground">Less</span>
                  <div className="flex gap-1">
                    <div className="w-4 h-4 bg-muted rounded-sm" />
                    <div className="w-4 h-4 bg-muted rounded-sm" />
                    <div className="w-4 h-4 bg-primary rounded-sm" />
                    <div className="w-4 h-4 bg-primary rounded-sm" />
                    <div className="w-4 h-4 bg-primary rounded-sm" />
                  </div>
                  <span className="text-xs text-muted-foreground">More</span>
                </div>
                
                {/* Peak time insight */}
                {data.heatmap.max_value > 0 && (
                  <div className="mt-4 p-3 bg-muted rounded-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Peak Activity Insight</p>
                      <p className="text-xs text-primary">
                        Highest engagement with up to {data.heatmap.max_value} messages in a single hour
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsInsights;
