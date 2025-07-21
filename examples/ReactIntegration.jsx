import React, { useState, useRef, useEffect } from 'react';

// Custom hook for streaming agent communication
const useStreamingAgent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ step: 0, total: 5, content: '' });
  const [messages, setMessages] = useState([]);
  const abortControllerRef = useRef(null);

  const sendMessage = async (message, sessionId = 'default') => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    setProgress({ step: 1, total: 5, content: 'Initializing...' });

    // Add user message
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: message, timestamp: new Date() },
    ]);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('http://localhost:3060/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId,
          creds: {}, // Add your OAuth credentials here
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantMessage = {
        role: 'assistant',
        content: '',
        alternatives: null,
        conflict: false,
        timestamp: new Date(),
      };

      function readStream() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              setIsLoading(false);
              setProgress({ step: 0, total: 5, content: '' });
              return;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            lines.forEach((line) => {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  handleEvent(data, assistantMessage);
                } catch (e) {
                  // Ignore parsing errors
                }
              }
            });

            readStream();
          })
          .catch((error) => {
            if (error.name === 'AbortError') {
              console.log('Request was aborted');
            } else {
              console.error('Error reading stream:', error);
              setIsLoading(false);
              setProgress({ step: 0, total: 5, content: '' });
            }
          });
      }

      readStream();
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
      setProgress({ step: 0, total: 5, content: '' });
    }
  };

  const handleEvent = (data, assistantMessage) => {
    switch (data.type) {
      case 'thinking':
        setProgress({ step: 1, total: 5, content: data.content });
        break;
      case 'progress':
        if (data.data && data.data.step) {
          setProgress({
            step: data.data.step,
            total: data.data.total,
            content: data.content,
          });
        } else {
          setProgress((prev) => ({ ...prev, content: data.content }));
        }
        break;
      case 'response':
        assistantMessage.content = data.content;
        assistantMessage.alternatives = data.alternatives;
        assistantMessage.conflict = data.conflict;
        setMessages((prev) => [...prev, assistantMessage]);
        break;
      case 'error':
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${data.content}`,
            isError: true,
            timestamp: new Date(),
          },
        ]);
        break;
      case 'complete':
        setProgress({ step: 5, total: 5, content: 'Complete!' });
        break;
    }
  };

  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setProgress({ step: 0, total: 5, content: '' });
  };

  return {
    sendMessage,
    cancelRequest,
    isLoading,
    progress,
    messages,
  };
};

// Main Chat Component
const DeanaChat = () => {
  const [inputValue, setInputValue] = useState('');
  const { sendMessage, cancelRequest, isLoading, progress, messages } =
    useStreamingAgent();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="deana-chat">
      <div className="chat-header">
        <h2>🤖 Deana AI Assistant</h2>
        <p>Your intelligent calendar management assistant</p>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h3>Welcome to Deana!</h3>
            <p>I can help you manage your calendar. Try asking me to:</p>
            <ul>
              <li>"Create a meeting with John tomorrow at 2pm"</li>
              <li>"What meetings do I have tomorrow?"</li>
              <li>"Schedule a coffee chat next week"</li>
            </ul>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role} ${
              message.isError ? 'error' : ''
            }`}
          >
            <div className="message-content">
              {message.content}
              {message.alternatives && message.alternatives.length > 0 && (
                <div className="alternatives">
                  <h4>🕐 Alternative Time Slots:</h4>
                  <div className="alternatives-grid">
                    {message.alternatives.map((alt, i) => (
                      <button key={i} className="alternative-option">
                        {alt.label}: {alt.timeDisplay}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {isLoading && (
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(progress.step / progress.total) * 100}%` }}
            />
          </div>
          <div className="progress-text">
            {progress.content} ({progress.step}/{progress.total})
          </div>
          <button onClick={cancelRequest} className="cancel-button">
            Cancel
          </button>
        </div>
      )}

      <div className="chat-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me to schedule a meeting, check your calendar, or anything else..."
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
          className="send-button"
        >
          {isLoading ? '⏳' : '📤'}
        </button>
      </div>

      <style jsx>{`
        .deana-chat {
          max-width: 800px;
          margin: 0 auto;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .chat-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          text-align: center;
        }

        .chat-header h2 {
          margin: 0 0 5px 0;
          font-size: 24px;
        }

        .chat-header p {
          margin: 0;
          opacity: 0.9;
          font-size: 14px;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #f8f9fa;
        }

        .welcome-message {
          text-align: center;
          padding: 40px 20px;
          color: #6c757d;
        }

        .welcome-message h3 {
          color: #495057;
          margin-bottom: 15px;
        }

        .welcome-message ul {
          text-align: left;
          max-width: 400px;
          margin: 20px auto;
        }

        .message {
          margin-bottom: 15px;
          max-width: 80%;
        }

        .message.user {
          margin-left: auto;
        }

        .message.assistant {
          margin-right: auto;
        }

        .message-content {
          padding: 12px 16px;
          border-radius: 18px;
          position: relative;
        }

        .message.user .message-content {
          background: #007bff;
          color: white;
        }

        .message.assistant .message-content {
          background: white;
          border: 1px solid #e9ecef;
          color: #495057;
        }

        .message.error .message-content {
          background: #f8d7da;
          border-color: #f5c6cb;
          color: #721c24;
        }

        .message-timestamp {
          font-size: 11px;
          color: #6c757d;
          margin-top: 4px;
          text-align: right;
        }

        .alternatives {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e9ecef;
        }

        .alternatives h4 {
          margin: 0 0 10px 0;
          color: #495057;
          font-size: 14px;
        }

        .alternatives-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 8px;
        }

        .alternative-option {
          padding: 8px 12px;
          background: #e3f2fd;
          border: 1px solid #bbdefb;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .alternative-option:hover {
          background: #bbdefb;
          border-color: #90caf9;
        }

        .progress-container {
          padding: 15px 20px;
          background: #f8f9fa;
          border-top: 1px solid #e9ecef;
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .progress-bar {
          flex: 1;
          height: 6px;
          background: #e9ecef;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea, #764ba2);
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 12px;
          color: #6c757d;
          white-space: nowrap;
        }

        .cancel-button {
          padding: 6px 12px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .cancel-button:hover {
          background: #c82333;
        }

        .chat-input {
          padding: 20px;
          border-top: 1px solid #e9ecef;
          display: flex;
          gap: 10px;
          background: white;
        }

        .chat-input input {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 25px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .chat-input input:focus {
          outline: none;
          border-color: #667eea;
        }

        .chat-input input:disabled {
          background: #f8f9fa;
          cursor: not-allowed;
        }

        .send-button {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: none;
          background: #667eea;
          color: white;
          cursor: pointer;
          font-size: 18px;
          transition: all 0.2s;
        }

        .send-button:hover:not(:disabled) {
          background: #5a6fd8;
          transform: scale(1.05);
        }

        .send-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
};

export default DeanaChat;
