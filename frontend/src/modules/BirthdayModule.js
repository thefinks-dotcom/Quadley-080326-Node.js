import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/App';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Cake, Send, Calendar, User as UserIcon } from 'lucide-react';

const BirthdayModule = () => {
  const { user } = useContext(AuthContext);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState([]);
  const [allBirthdays, setAllBirthdays] = useState({});
  const [view, setView] = useState('upcoming'); // upcoming, today, all
  const [wishMessage, setWishMessage] = useState('');
  const [showWishForm, setShowWishForm] = useState(null);

  useEffect(() => {
    fetchUpcomingBirthdays();
    fetchTodaysBirthdays();
    if (view === 'all') {
      fetchAllBirthdays();
    }
  }, [view]);

  const fetchUpcomingBirthdays = async () => {
    try {
      const response = await axios.get(`${API}/birthdays/upcoming`);
      setUpcomingBirthdays(response.data);
    } catch (error) {
      console.error('Failed to fetch upcoming birthdays', error);
    }
  };

  const fetchTodaysBirthdays = async () => {
    try {
      const response = await axios.get(`${API}/birthdays/today`);
      setTodaysBirthdays(response.data);
    } catch (error) {
      console.error('Failed to fetch todays birthdays', error);
    }
  };

  const fetchAllBirthdays = async () => {
    try {
      const response = await axios.get(`${API}/birthdays/all`);
      setAllBirthdays(response.data);
    } catch (error) {
      console.error('Failed to fetch all birthdays', error);
    }
  };

  const sendWish = async (userId) => {
    if (!wishMessage.trim()) {
      toast.error('Please enter a birthday message');
      return;
    }
    try {
      await axios.post(`${API}/birthdays/wish/${userId}`, {
        message: wishMessage
      });
      toast.success('Birthday wish sent! 🎉');
      setWishMessage('');
      setShowWishForm(null);
    } catch (error) {
      toast.error('Failed to send wish');
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6" data-testid="birthday-module">
      <div className="flex items-center justify-between">
        <h2 className="heading-font text-3xl font-bold flex items-center gap-2">
          <Cake className="h-8 w-8 text-primary" />
          Birthday Celebrations
        </h2>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2">
        <Button
          onClick={() => setView('today')}
          variant={view === 'today' ? 'default' : 'outline'}
          className={view === 'today' ? 'bg-gradient-to-r from-primary to-secondary' : ''}
        >
          Today
          {todaysBirthdays.length > 0 && (
            <Badge className="ml-2 bg-white text-primary">{todaysBirthdays.length}</Badge>
          )}
        </Button>
        <Button
          onClick={() => setView('upcoming')}
          variant={view === 'upcoming' ? 'default' : 'outline'}
          className={view === 'upcoming' ? 'bg-gradient-to-r from-primary to-secondary' : ''}
        >
          This Week
          {upcomingBirthdays.length > 0 && (
            <Badge className="ml-2 bg-white text-primary">{upcomingBirthdays.length}</Badge>
          )}
        </Button>
        <Button
          onClick={() => setView('all')}
          variant={view === 'all' ? 'default' : 'outline'}
          className={view === 'all' ? 'bg-gradient-to-r from-primary to-secondary' : ''}
        >
          All Birthdays
        </Button>
      </div>

      {/* Today's Birthdays View */}
      {view === 'today' && (
        <div>
          {todaysBirthdays.length === 0 ? (
            <Card className="p-8 text-center glass">
              <Cake className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No birthdays today</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {todaysBirthdays.map((person) => (
                <Card key={person.id} className="p-6 glass border-2 border-primary">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      {person.photo_url ? (
                        <img src={person.photo_url} alt={person.first_name} className="w-16 h-16 rounded-full object-cover" />
                      ) : (
                        <UserIcon className="h-8 w-8 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-xl">{person.first_name} {person.last_name}</h3>
                      <p className="text-sm text-muted-foreground">Floor: {person.floor || 'N/A'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Cake className="h-4 w-4 text-primary" />
                        <span className="text-lg font-semibold text-primary">🎉 Birthday Today! 🎂</span>
                      </div>
                    </div>
                  </div>

                  {/* Send Wish */}
                  <div className="mt-4 pt-4 border-t">
                    {showWishForm === person.id ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Write a birthday message... 🎂🎉"
                          value={wishMessage}
                          onChange={(e) => setWishMessage(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => sendWish(person.id)}
                            className="bg-gradient-to-r from-primary to-secondary"
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Send Wish
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowWishForm(null);
                              setWishMessage('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setShowWishForm(person.id)}
                        className="bg-gradient-to-r from-primary to-secondary"
                      >
                        <Cake className="mr-2 h-4 w-4" />
                        Send Birthday Wish
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Birthdays View */}
      {view === 'upcoming' && (
        <div>
          {upcomingBirthdays.length === 0 ? (
            <Card className="p-8 text-center glass">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No birthdays in the next 7 days</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcomingBirthdays.map((person) => (
                <Card key={person.id} className="p-6 glass hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        {person.photo_url ? (
                          <img src={person.photo_url} alt={person.first_name} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <UserIcon className="h-6 w-6 text-white" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{person.first_name} {person.last_name}</h3>
                        <p className="text-sm text-muted-foreground">Floor: {person.floor || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-muted text-primary border-destructive">
                        {person.days_until === 0 ? 'Today' : 
                         person.days_until === 1 ? 'Tomorrow' : 
                         `In ${person.days_until} days`}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(person.birthday_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Birthdays Calendar View */}
      {view === 'all' && (
        <div className="space-y-6">
          {Object.keys(allBirthdays).length === 0 ? (
            <Card className="p-8 text-center glass">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No birthdays found</p>
            </Card>
          ) : (
            Object.keys(allBirthdays).sort((a, b) => a - b).map((month) => (
              <Card key={month} className="p-6 glass">
                <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {monthNames[parseInt(month) - 1]}
                </h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allBirthdays[month].map((person) => (
                    <div key={person.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted transition-colors">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                        {person.photo_url ? (
                          <img src={person.photo_url} alt={person.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <UserIcon className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{person.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(`2024-${person.birthday}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default BirthdayModule;
