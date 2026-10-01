import type { ChatMessage } from "../lib/types";
import Avatar from "./Avatar";

interface ChatFeedProps {
  messages: ChatMessage[];
  botName: string;
  botColor: string;
}

export default function ChatFeed({ messages, botName, botColor }: ChatFeedProps) {
  if (messages.length === 0) return null;
  return (
    <div className="panel chat">
      <h3>Commentaar</h3>
      <div className="chat-list">
        {messages.slice(-20).map((message, index) => (
          <div className="chat-msg" key={`${message.ply}-${message.event}-${index}`}>
            <Avatar name={botName} color={botColor} size={26} />
            <span className="chat-bubble">{message.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
