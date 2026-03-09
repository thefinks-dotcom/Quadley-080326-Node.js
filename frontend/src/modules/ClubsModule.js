import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/App';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Upload, UserCheck, MessageSquare, Send } from 'lucide-react';

      </div>
    </div>
  );
};

// Clubs Module
const ClubsModule = () => {
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(null);
  const [showPhotoForm, setShowPhotoForm] = useState(null);
  const [showGroupChat, setShowGroupChat] = useState(null);
  const [groupChatMessages, setGroupChatMessages] = useState({});
  const [newChatMessage, setNewChatMessage] = useState({});
  const [photoUrl, setPhotoUrl] = useState('');
  const [newOwnerId, setNewOwnerId] = useState('');
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    meeting_times: '',
    other_details: ''
  });
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get(`${API}/cocurricular/groups/clubs`);
      setGroups(response.data);
    } catch (error) {
      console.error('Failed to fetch clubs', error);
    }
  };

  const createGroup = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/cocurricular/groups`, {
        ...newGroup,
        type: 'clubs'
      });
      toast.success('Club created!');
      setShowForm(false);
      setNewGroup({
        name: '',
        description: '',
        meeting_times: '',
        other_details: ''
      });
      fetchGroups();
    } catch (error) {
      toast.error('Failed to create club');
    }
  };

  const addPhoto = async (groupId) => {
    if (!photoUrl.trim()) {
      toast.error('Please enter a photo URL');
      return;
    }
    try {
      await axios.post(`${API}/cocurricular/groups/${groupId}/photos`, {
        photo_url: photoUrl
      });
      toast.success('Photo added!');
      setPhotoUrl('');
      setShowPhotoForm(null);
      fetchGroups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add photo');
    }
  };

  const removePhoto = async (groupId, photoIndex) => {
    try {
      await axios.delete(`${API}/cocurricular/groups/${groupId}/photos/${photoIndex}`);
      toast.success('Photo removed!');
      fetchGroups();
    } catch (error) {
      toast.error('Failed to remove photo');
    }
  };

  const transferOwnership = async (groupId) => {
    if (!newOwnerId) {
      toast.error('Please enter new owner ID');
      return;
    }
    try {
      await axios.put(`${API}/cocurricular/groups/${groupId}/transfer-ownership`, {
        new_owner_id: newOwnerId
      });
      toast.success('Ownership transferred!');
      setNewOwnerId('');
      setShowTransferForm(null);
      fetchGroups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to transfer ownership');
    }
  };

  const fetchGroupChat = async (messageGroupId, groupId) => {
    if (!messageGroupId) return;
    try {
      const response = await axios.get(`${API}/message-groups/${messageGroupId}/messages`);
      setGroupChatMessages(prev => ({ ...prev, [groupId]: response.data }));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      console.error('Failed to fetch group chat', error);
    }
  };

  const sendGroupChatMessage = async (messageGroupId, groupId) => {
    const message = newChatMessage[groupId]?.trim();
    if (!message) return;

    try {
      await axios.post(`${API}/messages`, {
        group_id: messageGroupId,
        content: message
      });
      setNewChatMessage(prev => ({ ...prev, [groupId]: '' }));
      fetchGroupChat(messageGroupId, groupId);
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const toggleGroupChat = (group) => {
    if (showGroupChat === group.id) {
      setShowGroupChat(null);
    } else {
      setShowGroupChat(group.id);
      if (group.message_group_id) {
        fetchGroupChat(group.message_group_id, group.id);
      }
    }
  };

  return (
    <div className="space-y-6" data-testid="clubs-module">
      <div className="flex items-center justify-between">
        <h2 className="heading-font text-3xl font-bold">Clubs</h2>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-primary to-secondary"
          data-testid="create-club-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Club
        </Button>
      </div>

      {showForm && (
        <Card className="p-6 glass">
          <h3 className="font-semibold mb-4">Create New Club</h3>
          <form onSubmit={createGroup} className="space-y-4" data-testid="club-form">
            <Input
              placeholder="Club Name"
              value={newGroup.name}
              onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
              required
              data-testid="club-name-input"
            />
            <Textarea
              placeholder="Description"
              value={newGroup.description}
              onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
              required
              data-testid="club-description-input"
            />
            <Input
              placeholder="Meeting Times"
              value={newGroup.meeting_times}
              onChange={(e) => setNewGroup({ ...newGroup, meeting_times: e.target.value })}
              data-testid="club-meeting-times-input"
            />
            <Textarea
              placeholder="Other Details"
              value={newGroup.other_details}
              onChange={(e) => setNewGroup({ ...newGroup, other_details: e.target.value })}
              data-testid="club-other-details-input"
            />
            <Button type="submit" data-testid="submit-club-btn" className="bg-gradient-to-r from-primary to-secondary">
              Create Club
            </Button>
          </form>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {groups.map((group, idx) => {
          const isOwner = user?.id === group.owner_id;
          const canManage = isOwner || user?.role === 'admin';
          
          return (
            <Card key={idx} data-testid={`club-${idx}`} className="p-6 glass">
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-xl">{group.name}</h3>
                  <p className="text-muted-foreground mt-2">{group.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">Owner: {group.owner_name}</p>
                </div>

                {/* Photo Gallery */}
                {group.photos && group.photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {group.photos.map((photo, photoIdx) => (
                      <div key={photoIdx} className="relative">
                        <img src={photo} alt={`Club photo ${photoIdx + 1}`} className="w-full h-32 object-cover rounded-lg" />
                        {canManage && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute top-1 right-1"
                            onClick={() => removePhoto(group.id, photoIdx)}
                          >
                            X
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {group.meeting_times && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-1">Meeting Times</h4>
                    <p className="text-sm text-muted-foreground">{group.meeting_times}</p>
                  </div>
                )}

                {group.other_details && (
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-1">Other Details</h4>
                    <p className="text-sm text-muted-foreground">{group.other_details}</p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Created: {new Date(group.created_at).toLocaleDateString()}
                </div>

                {canManage && (
                  <div className="pt-3 border-t border-border space-y-3">
                    {/* Add Photo */}
                    {showPhotoForm === group.id ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="Photo URL"
                          value={photoUrl}
                          onChange={(e) => setPhotoUrl(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => addPhoto(group.id)}
                            className="bg-gradient-to-r from-primary to-secondary"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Add Photo
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowPhotoForm(null);
                              setPhotoUrl('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowPhotoForm(group.id)}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Add Photo
                      </Button>
                    )}

                    {/* Transfer Ownership */}
                    {showTransferForm === group.id ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="New Owner User ID"
                          value={newOwnerId}
                          onChange={(e) => setNewOwnerId(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => transferOwnership(group.id)}
                            className="bg-gradient-to-r from-primary to-destructive"
                          >
                            Transfer Ownership
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowTransferForm(null);
                              setNewOwnerId('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowTransferForm(group.id)}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Transfer Ownership
                      </Button>
                    )}
                  </div>
                )}

                {/* Group Chat for Members */}
                {group.members?.includes(user?.id) && group.message_group_id && (
                  <div className="pt-3 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleGroupChat(group)}
                      className="w-full"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      {showGroupChat === group.id ? 'Hide Club Chat' : 'Open Club Chat'}
                    </Button>

                    {showGroupChat === group.id && (
                      <div className="mt-4 border rounded-lg p-4 bg-muted">
                        <h4 className="font-semibold mb-3 text-sm">Club Chat</h4>
                        
                        {/* Messages */}
                        <div className="h-64 overflow-y-auto mb-3 space-y-2 bg-white rounded p-2">
                          {groupChatMessages[group.id]?.length > 0 ? (
                            groupChatMessages[group.id].map((msg, idx) => (
                              <div
                                key={idx}
                                className={`p-2 rounded-lg ${
                                  msg.sender_id === user?.id
                                    ? 'bg-muted ml-8'
                                    : msg.sender_id === 'system'
                                    ? 'bg-warning/10 text-center text-sm italic'
                                    : 'bg-muted mr-8'
                                }`}
                              >
                                {msg.sender_id !== 'system' && (
                                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                                    {msg.sender_name}
                                  </div>
                                )}
                                <div className="text-sm">{msg.content}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {new Date(msg.timestamp).toLocaleString()}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center text-muted-foreground text-sm py-8">
                              No messages yet. Start the conversation!
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Type a message..."
                            value={newChatMessage[group.id] || ''}
                            onChange={(e) =>
                              setNewChatMessage(prev => ({ ...prev, [group.id]: e.target.value }))
                            }
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                sendGroupChatMessage(group.message_group_id, group.id);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => sendGroupChatMessage(group.message_group_id, group.id)}
                            className="bg-gradient-to-r from-primary to-secondary"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}

export default ClubsModule;
