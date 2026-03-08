'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Home, MessageSquare, Calendar, Users, Wrench, DollarSign, BookOpen,
  Heart, UtensilsCrossed, Building, Plus, Send, Bell, Sparkles, Award,
  Trophy, Camera, Zap, Shield, Lock, Briefcase, Upload, UserCheck, Settings,
  User, ChevronDown, AlertTriangle, Cake, X
} from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const PastoralCareModule = () => {
  const { user } = useContext(AuthContext);
  const [bookings, setBookings] = useState([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [newBooking, setNewBooking] = useState({ facility: 'Pastoral Care', date: '', duration: 30, purpose: '', booking_type: 'pastoral_care' });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings`);
      setBookings(response.data.filter(b => b.booking_type === 'pastoral_care'));
    } catch (error) {
      console.error('Failed to fetch bookings', error);
    }
  };

  const bookPastoralCare = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/bookings`, newBooking);
      toast.success('Pastoral care booked!');
      setShowBookingForm(false);
      setNewBooking({ facility: 'Pastoral Care', date: '', duration: 30, purpose: '', booking_type: 'pastoral_care' });
      fetchBookings();
    } catch (error) {
      toast.error('Failed to book pastoral care');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Pastoral Care"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <h2 className="heading-font text-3xl font-bold">Pastoral Care</h2>

      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Book a Session</h3>
          <Button size="sm" onClick={() => setShowBookingForm(!showBookingForm)} data-testid="book-pastoral-care-btn">
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </div>

        {showBookingForm && (
          <form onSubmit={bookPastoralCare} className="space-y-3 mb-4" data-testid="pastoral-care-form">
            <Input type="datetime-local" value={newBooking.date} onChange={(e) => setNewBooking({ ...newBooking, date: e.target.value })} required />
            <Input type="number" placeholder="Duration (minutes)" value={newBooking.duration} onChange={(e) => setNewBooking({ ...newBooking, duration: parseInt(e.target.value) })} />
            <Textarea placeholder="Purpose (optional)" value={newBooking.purpose} onChange={(e) => setNewBooking({ ...newBooking, purpose: e.target.value })} />
            <Button type="submit" size="sm">Book Session</Button>
          </form>
        )}

        <div className="space-y-3">
          <h4 className="font-semibold">Your Bookings</h4>
          {bookings.map((booking, idx) => (
            <div key={idx} data-testid={`booking-${idx}`} className="p-3 rounded-lg bg-white/50">
              <div className="font-semibold">{booking.facility}</div>
              <div className="text-sm text-muted-foreground">{new Date(booking.date).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{booking.duration} minutes</div>
            </div>
          ))}
          {bookings.length === 0 && <p className="text-muted-foreground text-sm">No bookings yet</p>}
        </div>
      </Card>
      </div>
    </div>
  );
};

// Wellness Resources Detail Module

export default PastoralCareModule;
