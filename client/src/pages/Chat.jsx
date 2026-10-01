import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { chatService } from '../services/chatService.js';
import { SOCKET_URL } from '../utils/constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/ui/Modal.jsx';
import {
  MessageSquare,
  Send,
  ShieldCheck,
  Users,
  Zap,
  Search,
  User,
  MapPin,
  Info,
  Paperclip,
  Check,
  CheckCheck,
} from 'lucide-react';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_REGEX = /(\+?\d[\d\s\-().]{7,}\d)/;

const containsContactInfo = (text) => EMAIL_REGEX.test(text) || PHONE_REGEX.test(text);

const formatTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getMessageKey = (message = {}) => {
  if (message._id) return `id:${message._id}`;
  if (message.id) return `id:${message.id}`;
  return `fallback:${message.chatId || ''}:${message.senderId || ''}:${message.createdAt || ''}:${message.messageText || ''}`;
};

const upsertMessage = (list = [], incoming) => {
  if (!incoming) return list;
  const incomingKey = getMessageKey(incoming);
  const existingIndex = list.findIndex((item) => getMessageKey(item) === incomingKey);
  if (existingIndex === -1) {
    return [...list, incoming];
  }
  const next = [...list];
  next[existingIndex] = { ...next[existingIndex], ...incoming };
  return next;
};

const dedupeMessages = (list = []) => {
  const byKey = new Map();
  list.forEach((item) => {
    byKey.set(getMessageKey(item), item);
  });
  return Array.from(byKey.values());
};

const Chat = () => {
  const { chatId: routeChatId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(routeChatId || '');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showStationDetailsModal, setShowStationDetailsModal] = useState(false);
  const [error, setError] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);

  const socketRef = useRef(null);
  const previousChatRef = useRef(null);
  const selectedChatRef = useRef(selectedChatId);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !user?._id) return;
    
    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    // Register user to receive messages
    socket.on('connect', () => {
      socket.emit('register:user', user._id);
    });

    socket.on('message:received', ({ chatId, message }) => {
      // Update messages if this is the active chat
      if (chatId === selectedChatRef.current || message?.chat === selectedChatRef.current) {
        setMessages((prev) => upsertMessage(prev, message));
      }
      // Always refresh chat list to update last message
      fetchChats(false);
    });

    socket.on('chat:updated', () => fetchChats(false));
    socket.on('message:read', ({ chatId, readAt }) => {
      if (chatId === selectedChatRef.current) {
        setMessages((prev) =>
          prev.map((msg) => {
            const senderId = msg.sender?._id || msg.sender || msg.senderId;
            const isMine = String(senderId) === String(user?._id);
            if (isMine && !msg.readAt) {
              return { ...msg, readAt: readAt || new Date().toISOString() };
            }
            return msg;
          })
        );
      }
      fetchChats(false);
    });

    return () => {
      socket.off('connect');
      socket.off('message:received');
      socket.off('chat:updated');
      socket.off('message:read');
      socket.disconnect();
    };
  }, [user?._id]);

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    selectedChatRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    const state = location.state;
    if (state?.chargerId) {
      startChatFromIntent(state);
    }
  }, [location.state]);

  useEffect(() => {
    if (routeChatId && routeChatId !== selectedChatId) {
      setSelectedChatId(routeChatId);
    }
  }, [routeChatId, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) return;
    const prev = previousChatRef.current;
    if (prev && prev !== selectedChatId) {
      leaveRoom(prev);
    }
    joinRoom(selectedChatId);
    previousChatRef.current = selectedChatId;
    fetchMessages(selectedChatId);
    markRead(selectedChatId);
  }, [selectedChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const joinRoom = (chatId) => {
    if (!socketRef.current || !chatId) return;
    socketRef.current.emit('join:room', `chat_${chatId}`);
    previousChatRef.current = chatId;
  };

  const leaveRoom = (chatId) => {
    if (!socketRef.current || !chatId) return;
    socketRef.current.emit('leave:room', `chat_${chatId}`);
  };

  const fetchChats = async (selectFirst = true) => {
    try {
      setLoadingChats(true);
      const response = await chatService.list();
      const payload = response.data || response;
      
      // Get chats from various possible response structures
      const rawChats = [
        ...(payload?.data?.chats || []),
        ...(payload?.chats || []),
        ...(payload?.data?.booked || payload?.booked || []),
        ...(payload?.data?.enquiries || payload?.enquiries || []),
      ].filter(Boolean);
      
      // Deduplicate by _id - keep the most recent version
      const byId = new Map();
      rawChats.forEach((chat) => {
        if (chat?._id) {
          const existing = byId.get(chat._id);
          if (!existing || new Date(chat.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
            byId.set(chat._id, chat);
          }
        }
      });
      
      const list = Array.from(byId.values());
      setChats(list);
      
      if (!selectedChatId && selectFirst && list.length) {
        setSelectedChatId(list[0]._id);
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('Unable to load chats');
    } finally {
      setLoadingChats(false);
    }
  };

  const startChatFromIntent = async ({ chargerId, bookingId }) => {
    try {
      setCreatingChat(true);
      const res = await chatService.startOrUpgrade({ chargerId, bookingId });
      const newChatId = res.data.chat._id;
      await fetchChats(false);
      setSelectedChatId(newChatId);
      navigate(`/chats/${newChatId}`, { replace: true, state: {} });
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to start chat');
    } finally {
      setCreatingChat(false);
    }
  };

  const fetchMessages = async (chatId) => {
    try {
      setLoadingMessages(true);
      const res = await chatService.getMessages(chatId);
      setMessages(dedupeMessages(res.data.messages || []));
    } catch (err) {
      setError('Unable to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const markRead = async (chatId) => {
    try {
      await chatService.markRead(chatId);
      fetchChats(false);
    } catch (err) {
      // ignore
    }
  };

  const handleSelectChat = (chatId) => {
    if (!chatId) return;
    setError('');
    setSelectedChatId(chatId);
    navigate(`/chats/${chatId}`, { replace: true });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (containsContactInfo(input)) {
      setError('Sharing contact information is not allowed.');
      return;
    }
    try {
      setError('');
      const trimmed = input.trim();
      setInput('');
      const res = await chatService.sendMessage(selectedChatId, trimmed);
      setMessages((prev) => upsertMessage(prev, res.data.message));
      fetchChats(false);
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to send message';
      setError(message);
    }
  };

  const selectedChat = useMemo(() => chats.find((c) => c._id === selectedChatId), [chats, selectedChatId]);

  const getChatTime = (chat) => {
    const time = chat.lastMessage?.createdAt || chat.lastMessage?.at || chat.updatedAt || chat.createdAt || 0;
    return new Date(time).getTime();
  };

  const sortedChats = useMemo(() => {
    const list = [...chats];
    return list.sort((a, b) => getChatTime(b) - getChatTime(a));
  }, [chats]);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return sortedChats;
    const q = searchQuery.toLowerCase();
    return sortedChats.filter((chat) => {
      const title = (chat.charger?.title || chat.chargerId?.title || chat.chargerTitle || '').toLowerCase();
      const otherParticipant = chat.participants?.find((p) => String(p._id || p) !== String(user?._id));
      const otherName = (otherParticipant?.name || '').toLowerCase();
      const lastMsg = (chat.lastMessage?.text || chat.lastMessage?.messageText || chat.lastMessage?.message || '').toLowerCase();
      return title.includes(q) || otherName.includes(q) || lastMsg.includes(q);
    });
  }, [sortedChats, searchQuery, user?._id]);

  const activeCharger = selectedChat?.charger || selectedChat?.chargerId;
  const activeChargerTitle = activeCharger?.title || selectedChat?.chargerTitle || 'EV Charging Station';
  const activeChargerId = activeCharger?._id || (typeof selectedChat?.charger === 'string' ? selectedChat.charger : null) || (typeof selectedChat?.chargerId === 'string' ? selectedChat.chargerId : null);
  const activeHost = selectedChat?.participants?.find((p) => String(p._id || p) !== String(user?._id));
  const activeHostName = activeHost?.name || 'Station Host';

  const formattedAddress = useMemo(() => {
    if (!activeCharger?.location) return '';
    const loc = activeCharger.location;
    const parts = [loc.address, loc.city, loc.state].filter(Boolean);
    return parts.join(', ');
  }, [activeCharger]);

  return (
    <div className="min-h-[calc(100vh-120px)] bg-[#ebf8f0] px-3 py-5 sm:px-6">
      <div className="mx-auto max-w-7xl rounded-3xl border border-emerald-100/90 bg-white shadow-xl overflow-hidden">
        {/* Top Header matching reference mockup */}
        <div className="flex flex-col gap-4 border-b border-gray-100 bg-white px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#daf5e3] text-[#009b65] shadow-xs">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">EVsathi Chat</h1>
              <p className="text-xs text-gray-500 font-medium">Peer-to-Peer Charging Station Messaging</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 sm:gap-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcf7e5] text-[#009b65]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 leading-tight">Secure &amp; Safe</p>
                <p className="text-[11px] text-gray-500">In-app messaging</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcf7e5] text-[#009b65]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 leading-tight">Connect Directly</p>
                <p className="text-[11px] text-gray-500">With station hosts</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcf7e5] text-[#009b65]">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 leading-tight">Smooth Charging</p>
                <p className="text-[11px] text-gray-500">Better coordination</p>
              </div>
            </div>
          </div>
        </div>

        {creatingChat && (
          <div className="bg-emerald-50/80 px-6 py-2 border-b border-emerald-100 flex items-center gap-2 text-xs font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Connecting to station host...
          </div>
        )}

        {error && (
          <div className="mx-6 my-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">{error}</div>
        )}

        {/* Main 2-column chat pane */}
        <div className="grid h-[72vh] grid-cols-1 overflow-hidden lg:grid-cols-[330px_1fr]">
          {/* Left: Conversations Sidebar */}
          <aside className="flex flex-col border-r border-gray-100 bg-white">
            <div className="border-b border-gray-100 px-4 pt-3 pb-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Conversations</p>
                <p className="text-xs text-gray-500 font-normal">{filteredChats.length} total</p>
              </div>

              {/* Search conversations input */}
              <div className="relative mt-2.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/80 py-2 pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#009b65] focus:bg-white focus:outline-none transition shadow-xs"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {loadingChats ? (
                <div className="px-4 py-8 text-center text-xs text-gray-400">Loading chats...</div>
              ) : filteredChats.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-gray-400">
                  {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const chargerTitle = chat.charger?.title || chat.chargerId?.title || chat.chargerTitle || 'EV Charging Station';
                  const otherParticipant = chat.participants?.find((p) => String(p._id || p) !== String(user?._id));
                  const otherName = otherParticipant?.name || 'Station Host';
                  const lastText = chat.lastMessage?.text || chat.lastMessage?.messageText || chat.lastMessage?.message || 'Started chat';
                  const lastTime = formatTime(chat.lastMessage?.at || chat.lastMessage?.createdAt || chat.updatedAt);
                  const isActive = selectedChatId === chat._id;

                  return (
                    <button
                      key={chat._id}
                      onClick={() => handleSelectChat(chat._id)}
                      className={`group relative flex w-full items-center gap-3 px-4 py-3.5 transition text-left ${
                        isActive ? 'bg-[#d8f6e2]' : 'hover:bg-gray-50/80'
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#009b65] text-sm font-bold text-white shadow-xs">
                        {(chargerTitle || 'C').charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="truncate text-sm font-bold text-gray-900">{chargerTitle}</p>
                          <span className="shrink-0 text-[11px] text-gray-500 font-medium">{lastTime}</span>
                        </div>
                        <p className="truncate text-xs text-gray-600 mt-0.5">With: {otherName}</p>
                        <div className="mt-0.5 flex items-center justify-between text-xs text-gray-500">
                          <span className="truncate">{lastText}</span>
                          {chat.unread > 0 && (
                            <span className="ml-1.5 flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-[#009b65] px-1 text-[10px] font-bold text-white">
                              {chat.unread}
                            </span>
                          )}
                        </div>
                      </div>

                      {isActive && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#00a86b]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right: Active Chat Area */}
          <section className="flex min-h-0 flex-col bg-white">
            {selectedChat ? (
              <>
                {/* Active Chat Header */}
                <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#009b65] text-base font-bold text-white shadow-xs">
                      {(activeChargerTitle || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-gray-900 leading-tight">
                        {activeChargerTitle}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                          Host: {activeHostName}
                        </span>
                        {formattedAddress && (
                          <span className="inline-flex items-center gap-1 truncate max-w-xs sm:max-w-md">
                            <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="truncate">{formattedAddress}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 pl-3">
                    {activeChargerId && (
                      <button
                        type="button"
                        onClick={() => navigate(`/chargers/${activeChargerId}`)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-[#e4f8ed] px-3.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 shadow-xs"
                      >
                        <Zap className="h-3.5 w-3.5 text-[#009b65]" />
                        <span>View Station</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowStationDetailsModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 shadow-xs"
                    >
                      <Info className="h-3.5 w-3.5 text-gray-500" />
                      <span>Station Details</span>
                    </button>
                  </div>
                </div>

                {/* Messages List Area */}
                <div className="flex-1 space-y-3 overflow-y-auto bg-white px-6 py-4">
                  {loadingMessages ? (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-xs text-gray-400">
                      No messages yet. Send a greeting to start chatting!
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const senderId = msg.sender?._id || msg.sender || msg.senderId;
                      const isMine = String(senderId) === String(user?._id);
                      return (
                        <div key={msg._id || getMessageKey(msg)} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                              isMine ? 'bg-[#dcf8c6] text-gray-900' : 'border border-gray-100 bg-white text-gray-900 shadow-xs'
                            }`}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.messageText}</p>
                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500">
                              <span>{formatTime(msg.createdAt)}</span>
                              {isMine && (
                                msg.readAt ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-[#009b65]" title={`Read at ${formatTime(msg.readAt)}`} />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-gray-400" title="Delivered (Unread by host)" />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Input Area */}
                <form onSubmit={handleSend} className="flex items-center gap-3 border-t border-gray-100 bg-white px-5 py-3">
                  <button
                    type="button"
                    aria-label="Attach file"
                    className="p-1 text-gray-600 transition hover:text-gray-900"
                  >
                    <Paperclip className="h-5 w-5 -rotate-45" />
                  </button>

                  <div className="flex-1">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a message..."
                      className="h-10 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#009b65] focus:outline-none transition shadow-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#009b65] px-5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#008757] disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    <Send className="h-4 w-4" />
                    <span>Send</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-gray-500">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#daf5e3] text-[#009b65]">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-gray-800">
                  {loadingChats ? 'Loading conversations...' : 'Select a conversation to start messaging'}
                </p>
                <p className="text-xs text-gray-400 max-w-xs">
                  Coordinate charging sessions and arrival times directly with station hosts
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Station Details Modal */}
      <Modal
        isOpen={showStationDetailsModal}
        onClose={() => setShowStationDetailsModal(false)}
        title={activeChargerTitle}
        subtitle="Station Specifications & Host Details"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-[#ebf8f0] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#009b65] text-white font-bold">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{activeChargerTitle}</h4>
                <p className="text-xs text-gray-600">Host: {activeHostName}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-gray-400 font-medium">Connector Type</p>
              <p className="font-semibold text-gray-800 mt-0.5">{activeCharger?.connectorType || 'Type 2'}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-gray-400 font-medium">Power Output</p>
              <p className="font-semibold text-gray-800 mt-0.5">{activeCharger?.powerOutput ? `${activeCharger.powerOutput} kW` : 'Fast Charging'}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-gray-400 font-medium">Charger Type</p>
              <p className="font-semibold text-gray-800 mt-0.5">{activeCharger?.chargerType || (activeCharger?.isFastCharger ? 'DC Fast Charger' : 'Level 2 AC')}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-gray-400 font-medium">Hourly Rate</p>
              <p className="font-semibold text-[#009b65] mt-0.5">{activeCharger?.pricePerHour ? `₹${activeCharger.pricePerHour}/hr` : 'Standard'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs">
            <p className="text-gray-400 font-medium">Station Location</p>
            <p className="font-semibold text-gray-800 mt-0.5">{formattedAddress || 'Location details available upon booking'}</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowStationDetailsModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
            >
              Close
            </button>
            {activeChargerId && (
              <button
                type="button"
                onClick={() => {
                  setShowStationDetailsModal(false);
                  navigate(`/chargers/${activeChargerId}`);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#009b65] hover:bg-[#008757] transition flex items-center gap-1.5"
              >
                <Zap className="h-3.5 w-3.5" />
                Open Station Page
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Chat;
