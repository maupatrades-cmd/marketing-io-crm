import { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function ChatWidget({ client, user, onAdmin }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [adminInfo, setAdminInfo] = useState(null);
  const messagesEndRef = useRef(null);
  const unsubscribeRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const comms = await base44.entities.ClientCommunication.filter(
        { client_id: client?.id },
        '-created_date',
        50
      );
      setMessages(Array.isArray(comms) ? comms : []);

      // Get admin info from first response
      if (comms && comms.length > 0) {
        const comm = comms[0];
        if (comm.responded_by_id) {
          const admin = await base44.entities.User.filter({ id: comm.responded_by_id });
          if (admin && admin[0]) {
            setAdminInfo(admin[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMessages();

      // Subscribe to new communications
      try {
        unsubscribeRef.current = base44.entities.ClientCommunication.subscribe((event) => {
          if (event.data?.client_id === client?.id) {
            setMessages((prev) => {
              const exists = prev.find((m) => m.id === event.data.id);
              if (exists) {
                return prev.map((m) => (m.id === event.data.id ? event.data : m));
              }
              return [event.data, ...prev];
            });
          }
        });
      } catch (err) {
        console.error('Subscription error:', err);
      }
    }

    return () => {
      unsubscribeRef.current?.();
    };
  }, [isOpen, client?.id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage;
    setNewMessage('');
    setIsSending(true);

    try {
      await base44.entities.ClientCommunication.create({
        client_id: client?.id,
        client_name: client?.business_name,
        sender_id: user?.id,
        sender_name: user?.full_name || user?.email,
        sender_email: user?.email,
        message_type: 'general_inquiry',
        subject: 'Direct Message',
        message: messageText,
        status: 'new',
        is_read: false,
        priority: 'normal'
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessage(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const unreadCount = messages.filter(
    (m) => m.sender_id === client?.id && !m.is_read
  ).length;

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-primary to-accent text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all hover:scale-110"
        >
          <div className="relative">
            <MessageCircle className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-destructive text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {Math.min(unreadCount, 9)}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-40 w-96 max-h-[600px] rounded-2xl glass border border-border/50 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-primary/10 to-accent/10">
            <div>
              <h3 className="font-bold text-foreground">Message Your Team</h3>
              <p className="text-xs text-muted-foreground">
                {adminInfo ? `${adminInfo.full_name}` : 'Your account admin'}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-secondary/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <MessageCircle className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Start a conversation with your team</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isFromClient = msg.sender_id === client?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isFromClient ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                        isFromClient
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-foreground'
                      }`}
                    >
                      <p>{msg.message}</p>
                      {msg.response_message && (
                        <div className={`mt-2 pt-2 border-t ${isFromClient ? 'border-primary-foreground/30' : 'border-border/30'}`}>
                          <p className="text-xs opacity-90">{msg.response_message}</p>
                        </div>
                      )}
                      <p className={`text-xs mt-1 ${isFromClient ? 'opacity-70' : 'text-muted-foreground'}`}>
                        {new Date(msg.created_date).toLocaleTimeString('en-ZA', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-border/50 bg-secondary/30">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={isSending}
                className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <Button
                type="submit"
                disabled={isSending || !newMessage.trim()}
                size="sm"
                className="bg-primary hover:bg-primary/90"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}