import React, { useState, useEffect, useRef } from 'react';

function AICopilotChat({ isOpen, onClose, history, onSendMessage }) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    onSendMessage(input);
    setInput('');
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px',
      right: '30px',
      width: '350px',
      height: '500px',
      background: '#050f19',
      border: '1px solid rgba(0, 242, 255, 0.3)',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 242, 255, 0.2)',
      animation: 'slideUp 0.3s ease-out',
      overflow: 'hidden',
      color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .message-bubble {
          max-width: 80%;
          padding: 10px 14px;
          border-radius: 12px;
          margin-bottom: 12px;
          font-size: 13px;
          line-height: 1.5;
        }
        .user-message {
          align-self: flex-end;
          background: #003033;
          border: 1px solid #00f2ff;
          color: #00f2ff;
        }
        .ai-message {
          align-self: flex-start;
          background: #0a1520;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .chat-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .chat-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 242, 255, 0.3);
          border-radius: 4px;
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid rgba(0, 242, 255, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#0a1d2e'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', background: '#00f2ff', borderRadius: '50%', boxShadow: '0 0 8px #00f2ff' }}></div>
          <span style={{ fontWeight: '600', letterSpacing: '0.5px', color: '#00f2ff', fontSize: '14px' }}>NEBULAAI COPILOT</span>
        </div>
        <button 
          onClick={onClose}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#00f2ff66', 
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px'
          }}
        >✕</button>
      </div>

      {/* Messages */}
      <div className="chat-scroll" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {history.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            color: '#00f2ff66', 
            marginTop: '100px',
            fontSize: '12px'
          }}>
            Greetings, Operator. How can I assist with your infrastructure today?
          </div>
        )}
        {history.map((msg, idx) => (
          <div key={idx} className={`message-bubble ${msg.role === 'user' ? 'user-message' : 'ai-message'}`}>
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        padding: '16px',
        borderTop: '1px solid rgba(0, 242, 255, 0.1)',
        display: 'flex',
        gap: '8px'
      }}>
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask NebulaAI..."
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(0, 242, 255, 0.2)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#fff',
            fontSize: '13px',
            outline: 'none'
          }}
        />
        <button 
          type="submit"
          style={{
            background: 'rgba(0, 242, 255, 0.2)',
            border: '1px solid #00f2ff',
            borderRadius: '8px',
            color: '#00f2ff',
            padding: '0 16px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '12px'
          }}
        >
          SEND
        </button>
      </form>
    </div>
  );
}

export default AICopilotChat;
