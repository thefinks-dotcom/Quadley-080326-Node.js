'use client';

import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { Wrench, Plus, Clock, CheckCircle } from 'lucide-react';
import ModuleHeader from '../ModuleHeader';

const MaintenanceModule = () => {
  const { user } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    room_number: '',
    issue_type: 'plumbing',
    description: '',
    priority: 'medium'
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API}/maintenance`);
      setRequests(res.data);
    } catch (error) {
      console.error('Failed to fetch requests', error);
    }
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/maintenance`, newRequest);
      toast.success('Maintenance request submitted!');
      setShowForm(false);
      setNewRequest({ room_number: '', issue_type: 'plumbing', description: '', priority: 'medium' });
      fetchRequests();
    } catch (error) {
      toast.error('Failed to submit request');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Services"
        showBack={true}
        showSearch={false}
        rightContent={
          <button
            onClick={() => setShowForm(v => !v)}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <Plus className="h-5 w-5 text-white" />
          </button>
        }
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <h1 className="text-3xl font-bold">Maintenance</h1>

      {showForm && (
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">New Maintenance Request</h2>
          <form onSubmit={submitRequest} className="space-y-4">
            <input
              type="text"
              placeholder="Room Number"
              value={newRequest.room_number}
              onChange={(e) => setNewRequest({ ...newRequest, room_number: e.target.value })}
              required
              className="w-full p-3 border rounded-lg"
            />
            <select
              value={newRequest.issue_type}
              onChange={(e) => setNewRequest({ ...newRequest, issue_type: e.target.value })}
              className="w-full p-3 border rounded-lg"
            >
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="heating">Heating/Cooling</option>
              <option value="furniture">Furniture</option>
              <option value="other">Other</option>
            </select>
            <textarea
              placeholder="Describe the issue..."
              value={newRequest.description}
              onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
              required
              className="w-full p-3 border rounded-lg min-h-[100px]"
            />
            <select
              value={newRequest.priority}
              onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value })}
              className="w-full p-3 border rounded-lg"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Submit Request</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-4">
        {requests.map((request) => (
          <Card key={request.id} className="p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={request.status === 'resolved' ? 'bg-success' : 'bg-warning'}>
                    {request.status === 'resolved' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                    {request.status}
                  </Badge>
                  <Badge variant="outline">{request.issue_type}</Badge>
                  <Badge variant="outline">{request.priority} priority</Badge>
                </div>
                <h3 className="font-semibold mb-1">Room {request.room_number}</h3>
                <p className="text-foreground">{request.description}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Submitted: {new Date(request.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {requests.length === 0 && (
        <Card className="p-12 text-center">
          <Wrench className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-xl text-muted-foreground">No maintenance requests</p>
        </Card>
      )}
      </div>
    </div>
  );
};

export default MaintenanceModule;
