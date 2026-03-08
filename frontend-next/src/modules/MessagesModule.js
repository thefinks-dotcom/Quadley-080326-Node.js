'use client';

import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { AuthContext, API } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { MessageSquare, Users, Plus, Send, X, ChevronLeft, Search, Check } from 'lucide-react';

const AVATAR_COLORS = [
  ['#7C3AED', '#A78BFA'],
  ['#2563EB', '#60A5FA'],
  ['#059669', '#34D399'],
  ['#D97706', '#FCD34D'],
  ['#DC2626', '#F87171'],
  ['#0E7490', '#67E8F9'],
  ['#BE185D', '#F472B6'],
  ['#92400E', '#FCD34D'],
];

const getAvatarColors = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const Avatar = ({ name = '', isGroup = false, size = 44 }) => {
  const [from, to] = getAvatarColors(name);
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const iconSize = Math.round(size * 0.44);
  return (
    <div
      className="rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${from}, ${to})`, fontSize: size * 0.33 }}
    >
      {isGroup
        ? <Users style={{ width: iconSize, height: iconSize }} />
        : <span>{initials}</span>}
    </div>
  );
};

const MessagesModule = () => {
  const { user } = useContext(AuthContext);
  const [view, setView] = useState('list');
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [convSearch, setConvSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [sending, setSending] = useState(false);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const messagesEndRef = useRef(null);
  const pollingRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    fetchUsers();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedConv) {
      fetchMessages();
      markRead();
      pollingRef.current = setInterval(fetchMessages, 5000);
      return () => clearInterval(pollingRef.current);
    }
  }, [selectedConv?.conversation_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API}/conversations`);
      setConversations(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  const fetchMessages = async () => {
    if (!selectedConv) return;
    try {
      const endpoint = selectedConv.type === 'group'
        ? `${API}/message-groups/${selectedConv.conversation_id}/messages`
        : `${API}/conversations/${selectedConv.conversation_id}/messages`;
      const res = await axios.get(endpoint);
      setMessages(res.data);
    } catch {}
  };

  const markRead = async () => {
    if (!selectedConv) return;
    try {
      if (selectedConv.type === 'group') {
        await axios.put(`${API}/message-groups/${selectedConv.conversation_id}/read`);
      } else {
        await axios.put(`${API}/conversations/${selectedConv.conversation_id}/read`);
      }
      setConversations(prev => prev.map(c =>
        c.conversation_id === selectedConv.conversation_id ? { ...c, unread_count: 0 } : c
      ));
    } catch {}
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(Array.isArray(res.data) ? res.data.filter(u => u.id !== user?.id) : []);
    } catch {}
  };

  const openConv = (conv) => {
    setSelectedConv(conv);
    setMessages([]);
    setView('chat');
    setTimeout(() => textareaRef.current?.focus(), 300);
  };

  const goBack = () => {
    clearInterval(pollingRef.current);
    setView('list');
    setSelectedConv(null);
    setMessages([]);
    fetchConversations();
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    const content = newMessage.trim();
    if (!content || !selectedConv || sending) return;
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId, sender_id: user?.id,
      sender_name: `${user?.first_name} ${user?.last_name}`,
      content, timestamp: new Date().toISOString(), _optimistic: true,
    }]);
    setNewMessage('');
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
    setSending(true);
    try {
      const data = selectedConv.type === 'group'
        ? { group_id: selectedConv.conversation_id, content }
        : { receiver_id: selectedConv.other_user?.id, content };
      await axios.post(`${API}/messages`, data);
      fetchMessages();
      fetchConversations();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(content);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaChange = (e) => {
    setNewMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const startConversation = async () => {
    if (!selectedUsers.length) { toast.error('Select at least one person'); return; }
    try {
      let newConvId = null;
      if (selectedUsers.length === 1) {
        await axios.post(`${API}/messages`, { receiver_id: selectedUsers[0].id, content: 'Hi!' });
      } else {
        if (!groupName.trim()) { toast.error('Enter a group name'); return; }
        const res = await axios.post(`${API}/message-groups`, {
          name: groupName, member_ids: selectedUsers.map(u => u.id),
        });
        newConvId = res.data.id;
      }
      const convRes = await axios.get(`${API}/conversations`);
      setConversations(convRes.data);
      const conv = selectedUsers.length === 1
        ? convRes.data.find(c => c.type === 'direct' && c.other_user?.id === selectedUsers[0].id)
        : convRes.data.find(c => c.type === 'group' && c.conversation_id === newConvId);
      setSelectedUsers([]);
      setGroupName('');
      setUserSearch('');
      if (conv) openConv(conv);
      else setView('list');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start conversation');
    }
  };

  const loadGroupMembers = async () => {
    if (!selectedConv || selectedConv.type !== 'group') return;
    try {
      const res = await axios.get(`${API}/users`);
      setGroupMembers(selectedConv.members.map(id => res.data.find(u => u.id === id)).filter(Boolean));
      setShowGroupMembers(true);
    } catch { toast.error('Failed to load members'); }
  };

  const formatTime = (ts) => {
    const date = new Date(ts);
    const now = new Date();
    const days = Math.floor((now - date) / 86400000);
    if (days === 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (ts) =>
    new Date(ts).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const filteredConvs = conversations.filter(c => {
    const name = c.type === 'group' ? c.group_name : c.other_user?.name || '';
    return name.toLowerCase().includes(convSearch.toLowerCase());
  });

  const filteredUsers = userSearch.trim()
    ? users.filter(u =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
      )
    : users;

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  // ── CHAT VIEW ──────────────────────────────────────────────────────────────
  if (view === 'chat' && selectedConv) {
    const chatName = selectedConv.type === 'group'
      ? selectedConv.group_name
      : selectedConv.other_user?.name || 'Chat';
    const chatSub = selectedConv.type === 'group'
      ? `${selectedConv.members.length} members`
      : selectedConv.other_user?.role || '';
    const [colorFrom, colorTo] = getAvatarColors(chatName);

    return (
      <div className="flex flex-col bg-background" style={{ position: 'fixed', inset: 0, zIndex: 60 }} data-testid="chat-view">
        {/* Chat header */}
        <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})`, paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
          <button onClick={goBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <Avatar name={chatName} isGroup={selectedConv.type === 'group'} size={38} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base leading-tight truncate">{chatName}</p>
            {chatSub && <p className="text-xs text-white/70 capitalize">{chatSub}</p>}
          </div>
          {selectedConv.type === 'group' && (
            <button onClick={loadGroupMembers}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              <Users className="h-4 w-4 text-white" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: '#F5F4FB', minHeight: 0 }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center pb-8">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-3"
                style={{ background: `${colorFrom}22` }}>
                <MessageSquare className="h-8 w-8" style={{ color: colorFrom }} />
              </div>
              <p className="font-semibold text-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-1">Send the first message!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.sender_id === user?.id;
              const prev = messages[idx - 1];
              const next = messages[idx + 1];
              const showDate = idx === 0 ||
                new Date(prev.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
              const sameSenderPrev = !showDate && prev && prev.sender_id === msg.sender_id;
              const sameSenderNext = next && next.sender_id === msg.sender_id &&
                new Date(next.timestamp).toDateString() === new Date(msg.timestamp).toDateString();
              const isLastInGroup = !sameSenderNext;
              const isGroup = selectedConv.type === 'group';

              return (
                <div key={msg.id || idx}>
                  {showDate && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground font-medium px-3 py-1 rounded-full bg-white border border-border">
                        {formatFullDate(msg.timestamp)}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

                  <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} ${sameSenderPrev ? 'mt-0.5' : 'mt-3'}`}>
                    {!isMe && (
                      <div className="w-7 flex-shrink-0">
                        {isGroup && isLastInGroup && !isMe && (
                          <Avatar name={msg.sender_name || ''} size={28} />
                        )}
                      </div>
                    )}

                    <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {!isMe && isGroup && !sameSenderPrev && (
                        <p className="text-xs font-semibold mb-1 ml-1" style={{ color: colorFrom }}>
                          {msg.sender_name}
                        </p>
                      )}
                      <div
                        className={`px-3.5 py-2.5 text-sm break-words leading-relaxed ${
                          isMe
                            ? `text-white ${isLastInGroup ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl'} ${msg._optimistic ? 'opacity-60' : ''}`
                            : `bg-white text-foreground ${isLastInGroup ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl'}`
                        }`}
                        style={isMe
                          ? { background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})`, boxShadow: `0 2px 8px ${colorFrom}44` }
                          : { boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.06)' }
                        }
                      >
                        {msg.content}
                      </div>
                      {isLastInGroup && (
                        <p className={`text-[10px] text-muted-foreground mt-1 ${isMe ? 'text-right' : 'text-left ml-1'}`}>
                          {formatTime(msg.timestamp)}
                          {isMe && <span className="ml-1 opacity-70">{msg._optimistic ? '◌' : '✓'}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 bg-white border-t border-border px-4 pt-3"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <form onSubmit={sendMessage} className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              placeholder="Message..."
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              rows={1}
              className="flex-1 resize-none bg-muted rounded-2xl px-4 py-2.5 text-sm outline-none border-none leading-relaxed"
              style={{ minHeight: 42, maxHeight: 120 }}
              data-testid="message-input"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-all active:scale-95"
              style={{ background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})` }}
              data-testid="send-btn"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </form>
        </div>

        {/* Group members sheet */}
        {showGroupMembers && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowGroupMembers(false)}>
            <div className="bg-white w-full rounded-t-3xl p-6 max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Members ({groupMembers.length})</h3>
                <button onClick={() => setShowGroupMembers(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {groupMembers.map(m => {
                  const fullName = `${m.first_name || ''} ${m.last_name || ''}`.trim();
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted">
                      <Avatar name={fullName} size={40} />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{fullName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                      </div>
                      {m.id === user?.id && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${colorFrom}20`, color: colorFrom }}>You</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── NEW CONVERSATION VIEW ──────────────────────────────────────────────────
  if (view === 'new') {
    return (
      <div className="flex flex-col bg-background" style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
          style={{ background: 'hsl(var(--primary))', paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
          <button
            onClick={() => { setView('list'); setSelectedUsers([]); setGroupName(''); setUserSearch(''); }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <div className="flex-1">
            <p className="font-bold text-white">{selectedUsers.length > 1 ? 'New Group Chat' : 'New Message'}</p>
            <p className="text-xs text-white/70">{selectedUsers.length} selected</p>
          </div>
          {selectedUsers.length > 0 && (
            <button onClick={startConversation}
              className="px-4 py-1.5 rounded-xl text-sm font-bold bg-white"
              style={{ color: 'hsl(var(--primary))' }}>
              {selectedUsers.length > 1 ? 'Create' : 'Start'}
            </button>
          )}
        </div>

        {/* Selected chips + group name */}
        {selectedUsers.length > 0 && (
          <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-background">
            {selectedUsers.length > 1 && (
              <input type="text" placeholder="Group name..."
                value={groupName} onChange={e => setGroupName(e.target.value)}
                className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm outline-none border-none mb-2"
              />
            )}
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map(u => (
                <span key={u.id} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full text-white"
                  style={{ background: 'hsl(var(--primary))' }}>
                  {u.first_name} {u.last_name}
                  <button onClick={() => setSelectedUsers(prev => prev.filter(x => x.id !== u.id))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-2 bg-muted rounded-2xl px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search people..." autoFocus
              value={userSearch} onChange={e => setUserSearch(e.target.value)}
              className="bg-transparent outline-none border-none text-sm flex-1" />
            {userSearch && (
              <button onClick={() => setUserSearch('')}><X className="h-4 w-4 text-muted-foreground" /></button>
            )}
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No users found</p>
          ) : filteredUsers.map(u => {
            const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
            const isSelected = selectedUsers.some(x => x.id === u.id);
            return (
              <button key={u.id}
                onClick={() => setSelectedUsers(prev => isSelected ? prev.filter(x => x.id !== u.id) : [...prev, u])}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-colors mb-1 ${isSelected ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                <div className="relative">
                  <Avatar name={fullName} size={44} />
                  {isSelected && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'hsl(var(--primary))' }}>
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{fullName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── CONVERSATION LIST VIEW ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-background" data-testid="messages-module">
      {/* Header */}
      <div className="flex-shrink-0" style={{ background: 'hsl(var(--primary))' }}>
        <div className="px-4 flex items-center gap-3 pb-3"
          style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
          <div className="flex-1">
            <p className="font-bold text-white text-xl">Messages</p>
            {totalUnread > 0 && (
              <p className="text-xs text-white/70">{totalUnread} unread message{totalUnread !== 1 ? 's' : ''}</p>
            )}
          </div>
          <button
            onClick={() => { setView('new'); setSelectedUsers([]); setGroupName(''); setUserSearch(''); }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}
            aria-label="New conversation"
            data-testid="new-conversation-btn"
          >
            <Plus className="h-5 w-5 text-white" />
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.6)' }} />
            <input type="text" placeholder="Search conversations..."
              value={convSearch} onChange={e => setConvSearch(e.target.value)}
              className="bg-transparent outline-none border-none text-sm flex-1 text-white"
              style={{ '::placeholder': { color: 'rgba(255,255,255,0.5)' } }}
              data-testid="conversation-search"
            />
            {convSearch && (
              <button onClick={() => setConvSearch('')}>
                <X className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 px-4 pt-3 pb-24">
        {filteredConvs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-8 w-8 text-primary/40" />
            </div>
            <p className="font-semibold text-foreground">
              {convSearch ? 'No results' : 'No conversations yet'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {convSearch ? 'Try a different search' : 'Tap + to start a new chat'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConvs.map(conv => {
              const name = conv.type === 'group' ? conv.group_name : conv.other_user?.name || 'Unknown';
              const isGroup = conv.type === 'group';
              const lastMsg = conv.last_message;
              const hasUnread = conv.unread_count > 0;

              return (
                <button key={conv.conversation_id}
                  onClick={() => openConv(conv)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all ${hasUnread ? 'bg-white' : 'hover:bg-muted/60'}`}
                  style={hasUnread ? { boxShadow: '0 2px 10px rgba(0,0,0,0.08)' } : {}}
                  data-testid={`conversation-${conv.conversation_id}`}
                >
                  <Avatar name={name} isGroup={isGroup} size={50} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${hasUnread ? 'font-bold' : 'font-semibold'} text-foreground`}>
                        {name}
                      </span>
                      <span className={`text-[11px] flex-shrink-0 ${hasUnread ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                        {lastMsg ? formatTime(lastMsg.timestamp) : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={`text-sm flex-1 truncate ${hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {lastMsg
                          ? `${isGroup && lastMsg.sender_name ? lastMsg.sender_name.split(' ')[0] + ': ' : ''}${lastMsg.content}`
                          : isGroup ? `${conv.members?.length || 0} members` : 'No messages yet'
                        }
                      </p>
                      {hasUnread && (
                        <span className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                          style={{ background: 'hsl(var(--primary))' }}>
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesModule;
