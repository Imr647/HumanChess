import { useEffect, useRef } from "react";

import type { ChatMessage } from "../lib/types";
import Avatar from "./Avatar";

interface ChatFeedProps {
  messages: ChatMessage[];
  botName: string;
  botColor: string;
}

export default function ChatFeed({ messages, botName, botColor }: ChatFeedProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (messages.length === 0) return null;
  return (
    <div className="panel chat">
      <h3>Commentaar</h3>
      <div className="chat-list" ref={listRef}>
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
