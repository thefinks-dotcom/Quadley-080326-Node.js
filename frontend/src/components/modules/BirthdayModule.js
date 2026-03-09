import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext, API } from '../../App';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Cake, Gift, Send } from 'lucide-react';
import ModuleHeader from '../ModuleHeader';

const BirthdayModule = () => {
  const { user } = useContext(AuthContext);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [wishMessage, setWishMessage] = useState('');

  useEffect(() => {
    fetchUpcomingBirthdays();
    fetchTodaysBirthdays();
  }, []);

  const fetchUpcomingBirthdays = async () => {
    try {
      const res = await axios.get(`${API}/birthdays/upcoming`);
      setUpcomingBirthdays(res.data);
    } catch (error) {
      console.error('Failed to fetch upcoming birthdays', error);
    }
  };

  const fetchTodaysBirthdays = async () => {
    try {
      const res = await axios.get(`${API}/birthdays/today`);
      setTodaysBirthdays(res.data);
    } catch (error) {
      console.error('Failed to fetch todays birthdays', error);
    }
  };

  const sendBirthdayWish = async (userId) => {
    if (!wishMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      await axios.post(`${API}/birthdays/${userId}/wish`, {
        message: wishMessage
      });
      toast.success('Birthday wish sent!');
      setWishMessage('');
      setSelectedUser(null);
    } catch (error) {
      toast.error('Failed to send wish');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="Birthdays"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <h1 className="text-4xl font-bold gradient-text">🎂 Birthdays</h1>

      {/* Today's Birthdays */}
      {todaysBirthdays.length > 0 && (
        <Card className="p-6 bg-gradient-to-r from-muted to-muted">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Cake className="text-primary" />
            Today's Birthdays! 🎉
          </h2>
          <div className="space-y-4">
            {todaysBirthdays.map((person) => (
              <div key={person.id} className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">{person.first_name} {person.last_name}</p>
                  <p className="text-muted-foreground">{person.role}</p>
                  {person.floor && <p className="text-sm text-muted-foreground">Floor: {person.floor}</p>}
                </div>
                <Button 
                  onClick={() => setSelectedUser(person)}
                  className="bg-gradient-to-r from-primary to-secondary"
                >
                  <Gift className="mr-2 h-4 w-4" />
                  Send Wish
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upcoming Birthdays */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Upcoming Birthdays (Next 7 Days)</h2>
        {upcomingBirthdays.length === 0 ? (
          <p className="text-muted-foreground">No upcoming birthdays in the next week</p>
        ) : (
          <div className="space-y-3">
            {upcomingBirthdays.map((person) => (
              <div key={person.id} className="bg-muted p-4 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-semibold">{person.first_name} {person.last_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {person.days_until === 0 ? 'Today!' : 
                     person.days_until === 1 ? 'Tomorrow' : 
                     `In ${person.days_until} days`}
                  </p>
                </div>
                <Cake className="text-destructive" />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Birthday Wish Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">
              Send Birthday Wish to {selectedUser.first_name}
            </h3>
            <textarea
              value={wishMessage}
              onChange={(e) => setWishMessage(e.target.value)}
              placeholder="Write your birthday message..."
              className="w-full p-3 border rounded-lg mb-4 min-h-[100px]"
            />
            <div className="flex gap-2">
              <Button 
                onClick={() => sendBirthdayWish(selectedUser.id)}
                className="flex-1 bg-gradient-to-r from-primary to-secondary"
              >
                <Send className="mr-2 h-4 w-4" />
                Send Wish
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setSelectedUser(null);
                  setWishMessage('');
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
};

export default BirthdayModule;
