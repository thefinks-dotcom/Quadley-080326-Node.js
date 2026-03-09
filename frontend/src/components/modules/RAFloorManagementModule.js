import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Home, AlertCircle, RefreshCw } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const RAFloorManagementModule = () => {
  const { user } = useContext(AuthContext);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResidents();
  }, []);

  const fetchResidents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/floor/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResidents(res.data || []);
    } catch (error) {
      toast.error('Could not load floor residents');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (first, last) => {
    return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Floor Management"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Home className="w-7 h-7 text-primary" />
          Floor Management
        </h1>
        <p className="text-muted-foreground mt-1">View and manage residents on your floor</p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">{residents.length} Residents</span>
        </div>
        <button
          onClick={fetchResidents}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {residents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No residents found on your floor</p>
            <p className="text-sm text-muted-foreground mt-1">Residents will appear here once added to the system</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {residents.map((resident) => (
            <Card key={resident.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {getInitials(resident.first_name, resident.last_name)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {resident.first_name} {resident.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{resident.email}</p>
                  </div>
                </div>
                {resident.room_number && (
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Room {resident.room_number}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default RAFloorManagementModule;
