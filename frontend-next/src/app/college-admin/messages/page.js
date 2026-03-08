'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  MessageSquare,
  Users,
  RefreshCw,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = '';

const MessageOverview = () => {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState('month');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/admin/messages/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch messages overview', error);
      toast.error('Failed to load messages overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getChartData = () => {
    if (!data?.chart_data) return [];
    return data.chart_data[timePeriod] || [];
  };

  const getMaxCount = () => {
    const chartData = getChartData();
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map(d => d.count), 1);
  };

  const getPeriodMessages = () => {
    if (!data?.stats) return 0;
    switch (timePeriod) {
      case 'month': return data.stats.messages_last_month;
      case 'quarter': return data.stats.messages_last_quarter;
      case 'year': return data.stats.messages_last_year;
      default: return 0;
    }
  };

  const getPeriodLabel = () => {
    switch (timePeriod) {
      case 'month': return 'Last 30 Days';
      case 'quarter': return 'Last Quarter';
      case 'year': return 'Last Year';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div>
      </div>
    );
  }

  const chartData = getChartData();
  const maxCount = getMaxCount();
  const totalInPeriod = getPeriodMessages();

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
              <h1 className="text-2xl font-bold text-foreground">Message Overview</h1>
              <p className="text-muted-foreground text-sm">Messaging activity statistics</p>
            </div>
          </div>
          <Button
            onClick={fetchOverview}
            variant="outline"
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {lastUpdated && (
          <p className="text-xs text-muted-foreground mb-6">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-muted to-muted border-border">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-primary rounded-xl">
                  <MessageSquare className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-4xl font-bold text-primary">{data?.stats?.total_messages?.toLocaleString() || 0}</p>
                  <p className="text-sm text-primary font-medium">Total Messages</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-success/10 to-success/10 border-success">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-success rounded-xl">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-4xl font-bold text-success">{data?.stats?.total_groups?.toLocaleString() || 0}</p>
                  <p className="text-sm text-success font-medium">Message Groups</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart Section */}
        <Card>
          <CardContent className="pt-6">
            {/* Chart Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-muted-foreground" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Message Activity</h2>
                  <p className="text-sm text-muted-foreground">{totalInPeriod.toLocaleString()} messages in {getPeriodLabel().toLowerCase()}</p>
                </div>
              </div>
              {/* Time Period Selector */}
              <div className="flex gap-1 bg-muted p-1 rounded-lg">
                <button
                  onClick={() => setTimePeriod('month')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    timePeriod === 'month' 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setTimePeriod('quarter')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    timePeriod === 'quarter' 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Quarter
                </button>
                <button
                  onClick={() => setTimePeriod('year')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    timePeriod === 'year' 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Year
                </button>
              </div>
            </div>

            {/* Bar Chart with Y-axis */}
            <div className="relative">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-12 w-12 flex flex-col justify-between text-xs text-muted-foreground pr-2">
                <span className="text-right">{maxCount}</span>
                <span className="text-right">{Math.round(maxCount * 0.75)}</span>
                <span className="text-right">{Math.round(maxCount * 0.5)}</span>
                <span className="text-right">{Math.round(maxCount * 0.25)}</span>
                <span className="text-right">0</span>
              </div>
              
              {/* Chart area */}
              <div className="ml-14">
                {/* Grid lines */}
                <div className="absolute left-14 right-4 top-0 h-[200px] flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="border-t border-border w-full" />
                  ))}
                </div>
                
                {/* Bars */}
                <div className="h-[200px] flex items-end gap-[2px] relative">
                  {chartData.map((item, idx) => {
                    const heightPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    const isHovered = hoveredBar === idx;
                    
                    return (
                      <div 
                        key={idx} 
                        className="flex-1 flex flex-col items-center relative"
                        onMouseEnter={() => setHoveredBar(idx)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        {/* Tooltip */}
                        {isHovered && (
                          <div className="absolute bottom-full mb-2 bg-primary text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 shadow-lg">
                            <div className="font-semibold">{item.count} messages</div>
                            <div className="text-muted-foreground">{item.date}</div>
                          </div>
                        )}
                        {/* Bar */}
                        <div 
                          className={`w-full rounded-t transition-all duration-150 cursor-pointer ${
                            isHovered ? 'bg-primary' : item.count > 0 ? 'bg-primary' : 'bg-muted'
                          }`}
                          style={{ 
                            height: `${Math.max(heightPercent, item.count > 0 ? 3 : 1)}%`,
                            minHeight: item.count > 0 ? '6px' : '2px'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                
                {/* X-axis labels */}
                <div className="flex mt-3 h-8 overflow-hidden">
                  {chartData.map((item, idx) => {
                    // Show fewer labels for readability
                    const showLabel = timePeriod === 'year' || 
                      (timePeriod === 'quarter' && idx % 2 === 0) ||
                      (timePeriod === 'month' && idx % 5 === 0);
                    
                    return (
                      <div key={idx} className="flex-1 text-center">
                        {showLabel && (
                          <span className="text-xs text-muted-foreground">{item.date}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart Footer */}
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>
                  {timePeriod === 'month' && 'Daily message count'}
                  {timePeriod === 'quarter' && 'Weekly message count'}
                  {timePeriod === 'year' && 'Monthly message count'}
                </span>
              </div>
              <div className="text-sm font-medium text-foreground">
                Average: {chartData.length > 0 
                  ? Math.round(chartData.reduce((sum, d) => sum + d.count, 0) / chartData.length)
                  : 0} per {timePeriod === 'month' ? 'day' : timePeriod === 'quarter' ? 'week' : 'month'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MessageOverview;
