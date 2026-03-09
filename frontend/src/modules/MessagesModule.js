import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { MessageSquare, Users, Plus, Send, X, UserPlus, Edit3, ChevronLeft } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

const ConversationAvatar = ({ conv, size = 'md' }) => {
  const isGroup = conv.type === 'group';
  const sz = size === 'md' ? 'w-12 h-12' : 'w-10 h-10';
  const iconSz = size === 'md' ? 'h-6 w-6' : 'h-5 w-5';
  const name = isGroup ? conv.group_name : conv.other_user?.name || '';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div
      className={`${sz} rounded-2xl flex items-center justify-center flex-shrink-0`}
      style={{ background: 'hsl(252 57% 90%)', color: 'hsl(var(--primary))' }}
    >
      {isGroup
        ? <Users className={iconSz} />
        : <span className="text-sm font-bold">{initials}</span>}
    </div>
  );
};

const MessagesModule = () => {
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    fetchUsers();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchConversationMessages(selectedConversation.conversation_id, selectedConversation.type);
      const timer = setTimeout(() => markConversationRead(selectedConversation.conversation_id), 2000);
      return () => clearTimeout(timer);
    }
  }, [selectedConversation]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const filtered = userSearch.trim()
      ? users.filter(u => u.id !== user?.id && (u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())))
      : users.filter(u => u.id !== user?.id);
    setFilteredUsers(filtered);
  }, [userSearch, users, user]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API}/conversations`);
      setConversations(res.data);
    } catch {}
  };

  const fetchConversationMessages = async (conversationId, convType) => {
    try {
      const type = convType || selectedConversation?.type;
      const endpoint = type === 'group'
        ? `${API}/message-groups/${conversationId}/messages`
        : `${API}/conversations/${conversationId}/messages`;
      const res = await axios.get(endpoint);
      setMessages(res.data);
    } catch (err) { console.error(err); }
  };

  const markConversationRead = async (conversationId) => {
    try {
      if (selectedConversation?.type === 'group') {
        await axios.put(`${API}/message-groups/${conversationId}/read`);
      } else {
        await axios.put(`${API}/conversations/${conversationId}/read`);
      }
      setConversations(prev => prev.map(c => c.conversation_id === conversationId ? { ...c, unread_count: 0 } : c));
      await fetchConversations();
    } catch {}
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
      setFilteredUsers(res.data.filter(u => u.id !== user?.id));
    } catch {}
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !selectedConversation) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId, sender_id: user?.id,
      sender_name: `${user?.first_name} ${user?.last_name}`,
      content, timestamp: new Date().toISOString(), _optimistic: true
    };
    setMessages(prev => [...prev, optimistic]);
    setNewMessage('');
    try {
      const data = selectedConversation.type === 'group'
        ? { group_id: selectedConversation.conversation_id, content }
        : { receiver_id: selectedConversation.other_user?.id, content };
      await axios.post(`${API}/messages`, data);
      fetchConversationMessages(selectedConversation.conversation_id, selectedConversation.type);
      fetchConversations();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(content);
      toast.error('Failed to send message');
    }
  };

  const toggleUserSelection = (u) => {
    setSelectedUsers(prev => prev.find(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]);
  };

  const startNewConversation = async () => {
    if (selectedUsers.length === 0) { toast.error('Please select at least one user'); return; }
    try {
      let newConvId = null;
      if (selectedUsers.length === 1) {
        await axios.post(`${API}/messages`, { receiver_id: selectedUsers[0].id, content: 'Hi!' });
        toast.success('Conversation started!');
      } else {
        if (!groupName.trim()) { toast.error('Please enter a group name'); return; }
        const res = await axios.post(`${API}/message-groups`, { name: groupName, member_ids: selectedUsers.map(u => u.id) });
        newConvId = res.data.id;
        toast.success('Group created!');
      }
      const convRes = await axios.get(`${API}/conversations`);
      setConversations(convRes.data);
      if (selectedUsers.length === 1) {
        const conv = convRes.data.find(c => c.type === 'direct' && c.other_user?.id === selectedUsers[0].id);
        if (conv) setSelectedConversation(conv);
      } else if (newConvId) {
        const group = convRes.data.find(c => c.type === 'group' && c.conversation_id === newConvId);
        if (group) setSelectedConversation(group);
      }
      setShowNewChatModal(false);
      setUserSearch('');
      setSelectedUsers([]);
      setGroupName('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start conversation');
    }
  };

  const viewGroupMembers = async () => {
    if (!selectedConversation || selectedConversation.type !== 'group') return;
    try {
      const res = await axios.get(`${API}/users`);
      const all = res.data;
      setGroupMembers(selectedConversation.members.map(id => all.find(u => u.id === id)).filter(Boolean));
      setShowGroupMembers(true);
    } catch { toast.error('Failed to load group members'); }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const days = Math.floor((now - date) / 86400000);
    if (days === 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const directConvs = conversations.filter(c => c.type === 'direct');
  const groupConvs = conversations.filter(c => c.type === 'group');

  const visibleConvs = conversations.filter(conv => {
    const name = conv.type === 'group' ? conv.group_name : conv.other_user?.name || '';
    const matchesSearch = name.toLowerCase().includes(conversationSearch.toLowerCase());
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'direct' && conv.type === 'direct') ||
      (activeFilter === 'groups' && conv.type === 'group');
    return matchesSearch && matchesFilter;
  });

  if (selectedConversation) {
    const chatTitle = selectedConversation.type === 'group'
      ? selectedConversation.group_name
      : selectedConversation.other_user?.name || 'Chat';
    const chatSub = selectedConversation.type === 'group'
      ? `${selectedConversation.members.length} members`
      : selectedConversation.other_user?.role || '';

    return (
      <div className="flex flex-col min-h-screen bg-background" data-testid="chat-view">
        <ModuleHeader
          title={chatTitle}
          subtitle={chatSub}
          showBack
          onBack={() => setSelectedConversation(null)}
          showSearch={false}
          rightContent={
            selectedConversation.type === 'group' ? (
              <button
                onClick={viewGroupMembers}
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <Users className="h-5 w-5 text-white" />
              </button>
            ) : null
          }
        />

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id;
            const showDate = idx === 0 || new Date(messages[idx - 1].timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
            return (
              <div key={idx}>
                {showDate && (
                  <div className="text-center text-xs text-muted-foreground my-3">
                    {new Date(msg.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                )}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] ${msg._optimistic ? 'opacity-70' : ''}`}>
                    {!isMe && selectedConversation.type === 'group' && (
                      <p className="text-xs text-muted-foreground mb-1 ml-1">{msg.sender_name}</p>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
                      isMe
                        ? 'text-white rounded-br-sm'
                        : 'bg-white text-foreground rounded-bl-sm border border-border'
                    }`} style={isMe ? { background: 'hsl(var(--primary))' } : {}}>
                      {msg.content}
                    </div>
                    <p className={`text-xs text-muted-foreground mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3" style={{ color: 'hsl(var(--primary)/0.3)' }} />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm mt-1">Say hi to start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="px-4 py-3 bg-white border-t border-border flex gap-2 items-center">
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-muted rounded-2xl px-4 py-2.5 text-sm outline-none border-none"
            data-testid="message-input"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40"
            style={{ background: 'hsl(var(--primary))' }}
            data-testid="send-btn"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </form>

        {showGroupMembers && (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowGroupMembers(false)}>
            <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Group Members</h3>
                <button onClick={() => setShowGroupMembers(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                {groupMembers.map(member => (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                      style={{ background: 'hsl(252 57% 90%)', color: 'hsl(var(--primary))' }}>
                      {member.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{member.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                    </div>
                    {member.id === user?.id && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: 'hsl(var(--primary)/0.1)', color: 'hsl(var(--primary))' }}>You</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background" data-testid="messages-module">
      <ModuleHeader
        title="Messages"
        subtitle={`${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`}
        showSearch
        searchValue={conversationSearch}
        onSearchChange={setConversationSearch}
        searchPlaceholder="Search conversations..."
      />

      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-2 bg-muted rounded-2xl p-1">
          {[
            { key: 'all', label: 'All', count: conversations.length },
            { key: 'direct', label: 'Direct', count: directConvs.length },
            { key: 'groups', label: 'Groups', count: groupConvs.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${
                activeFilter === tab.key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  activeFilter === tab.key
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 pb-4 space-y-2 mt-2">
        {visibleConvs.length > 0 ? (
          visibleConvs.map(conv => {
            const displayName = conv.type === 'group' ? conv.group_name : conv.other_user?.name || 'Unknown';
            return (
              <button
                key={conv.conversation_id}
                onClick={() => setSelectedConversation(conv)}
                className="w-full bg-white rounded-2xl p-4 flex items-center gap-3 text-left"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                data-testid={`conversation-${conv.conversation_id}`}
              >
                <ConversationAvatar conv={conv} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground truncate">{displayName}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {conv.last_message ? formatTime(conv.last_message.timestamp) : ''}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    {conv.type === 'group' && !conv.last_message ? (
                      <p className="text-sm text-muted-foreground">{conv.members.length} members</p>
                    ) : conv.last_message ? (
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.type === 'group' && conv.last_message.sender_name
                          ? `${conv.last_message.sender_name}: `
                          : ''}
                        {conv.last_message.content}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No messages yet</p>
                    )}
                  </div>
                </div>
                {conv.unread_count > 0 && (
                  <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(var(--primary))' }}>
                    {conv.unread_count}
                  </span>
                )}
              </button>
            );
          })
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3" style={{ color: 'hsl(var(--primary)/0.3)' }} />
            <p className="font-semibold">No conversations</p>
            <p className="text-sm mt-1">Tap the button below to start chatting</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-20 right-4 flex flex-col gap-3 z-40">
        <button
          onClick={() => {
            setSelectedUsers([]);
            setGroupName('');
            setUserSearch('');
            setShowNewChatModal('group');
          }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: 'hsl(var(--primary))' }}
          aria-label="New group chat"
        >
          <UserPlus className="h-6 w-6 text-white" />
        </button>
        <button
          onClick={() => {
            setSelectedUsers([]);
            setGroupName('');
            setUserSearch('');
            setShowNewChatModal('direct');
          }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
          style={{ background: 'hsl(var(--primary))' }}
          aria-label="New message"
        >
          <Edit3 className="h-6 w-6 text-white" />
        </button>
      </div>

      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowNewChatModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">
                  {selectedUsers.length > 1 ? 'Create Group Chat' : 'New Conversation'}
                </h3>
                <button onClick={() => { setShowNewChatModal(false); setSelectedUsers([]); setGroupName(''); }}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {selectedUsers.length > 0 && (
                <div className="mb-3 p-3 rounded-2xl bg-muted flex flex-wrap gap-2">
                  {selectedUsers.map(u => (
                    <span key={u.id} className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full text-white"
                      style={{ background: 'hsl(var(--primary))' }}>
                      {u.name}
                      <button onClick={() => toggleUserSelection(u)}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}

              {selectedUsers.length > 1 && (
                <input
                  type="text"
                  placeholder="Group name..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none border-none mb-3"
                />
              )}

              <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2.5">
                <span className="text-muted-foreground text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="bg-transparent outline-none border-none text-sm flex-1"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {filteredUsers.map(u => {
                const isSelected = !!selectedUsers.find(x => x.id === u.id);
                return (
                  <button key={u.id} onClick={() => toggleUserSelection(u)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: 'hsl(252 57% 90%)', color: 'hsl(var(--primary))' }}>
                      {u.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{u.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                    </div>
                    {isSelected && (
                      <span className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: 'hsl(var(--primary))' }}>
                        <span className="text-white text-xs">✓</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-border">
              <button
                onClick={startNewConversation}
                disabled={selectedUsers.length === 0 || (selectedUsers.length > 1 && !groupName.trim())}
                className="w-full py-3 rounded-2xl text-white font-semibold disabled:opacity-40"
                style={{ background: 'hsl(var(--primary))' }}
              >
                {selectedUsers.length > 1 ? `Create Group (${selectedUsers.length})` : 'Start Conversation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesModule;
